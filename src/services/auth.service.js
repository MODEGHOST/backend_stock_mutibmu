import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import { pool, withTx } from "../config/db.js";
import HttpError from "../utils/httpError.js";
import { getUserRoles, getUserPermissions } from "./rbac.service.js";


function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, company_id: user.company_id !== undefined ? user.company_id : null, email: user.email },
    env.ACCESS_TOKEN_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES }
  );
}

function makeRefreshPlain() {
  const raw = crypto.randomBytes(48).toString("hex");
  const sig = jwt.sign({ t: sha256(raw) }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_EXPIRES_DAYS}d`
  });
  return `${raw}.${sig}`;
}

function verifyRefreshPlain(token) {
  const idx = token.lastIndexOf(".");
  if (idx <= 0) throw new Error("bad token");
  const raw = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const payload = jwt.verify(sig, env.REFRESH_TOKEN_SECRET);
  const t = payload?.t;
  if (!t || t !== sha256(raw)) throw new Error("bad token");
  return sha256(token);
}

export async function seedSystemOwner() {
  await withTx(async (conn) => {
    const [u] = await conn.query(
      `SELECT id FROM users WHERE email = :email LIMIT 1`,
      { email: env.SYSTEM_OWNER_EMAIL }
    );
    if (u.length > 0) return;

    const password_hash = await bcrypt.hash(env.SYSTEM_OWNER_PASSWORD, 10);
    const [ins] = await conn.query(
      `
      INSERT INTO users (company_id, first_name, last_name, phone, email, password_hash, display_name, is_active)
      VALUES (NULL, :first_name, :last_name, :phone, :email, :password_hash, :display_name, 1)
      `,
      {
        first_name: env.SYSTEM_OWNER_FIRST_NAME,
        last_name: env.SYSTEM_OWNER_LAST_NAME,
        phone: "-",
        email: env.SYSTEM_OWNER_EMAIL,
        password_hash,
        display_name: "System Owner"
      }
    );
    const userId = ins.insertId;

    const [r] = await conn.query(
      `SELECT id FROM roles WHERE code='system_owner' AND company_id IS NULL LIMIT 1`
    );
    if (r.length === 0) throw new Error("system_owner role missing");
    const roleId = r[0].id;

    await conn.query(
      `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)`,
      { user_id: userId, role_id: roleId }
    );
  });
}

export async function login(email, password) {
  const [rows] = await pool.query(
    `SELECT id, company_id, email, password_hash, is_active FROM users WHERE email = :email LIMIT 1`,
    { email }
  );
  if (rows.length === 0) throw new HttpError(400, "Invalid credentials");
  const u = rows[0];
  if (!u.is_active) throw new HttpError(403, "User inactive");

  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) throw new HttpError(400, "Invalid credentials");

  const accessToken = signAccess(u);
  const refreshPlain = makeRefreshPlain();
  const token_hash = sha256(refreshPlain);

  const expires_at = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, :expires_at)`,
    { user_id: u.id, token_hash, expires_at }
  );

  return { accessToken, refreshToken: refreshPlain };
}

export async function refresh(refreshToken, switchCompanyId = undefined) {
  const token_hash = verifyRefreshPlain(refreshToken);

  const [rows] = await pool.query(
    `
    SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.id AS uid, u.company_id, u.email, u.is_active
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token_hash = :token_hash
    LIMIT 1
    `,
    { token_hash }
  );
  if (rows.length === 0) throw new HttpError(401, "Unauthorized");
  const r = rows[0];

  if (r.revoked_at) throw new HttpError(401, "Unauthorized");
  if (!r.is_active) throw new HttpError(403, "User inactive");
  if (new Date(r.expires_at).getTime() < Date.now()) throw new HttpError(401, "Unauthorized");

  let finalCompanyId = r.company_id;
  if (switchCompanyId !== undefined) {
    const roles = await getUserRoles(r.uid);
    if (roles.includes("system_owner")) {
      finalCompanyId = switchCompanyId === "null" || switchCompanyId === null ? null : Number(switchCompanyId);
    }
  }

  const accessToken = signAccess({ id: r.uid, company_id: finalCompanyId, email: r.email });
  return { accessToken };
}

export async function switchCompany(userId, targetCompanyId) {
  const roles = await getUserRoles(userId);
  if (!roles.includes("system_owner")) {
    throw new HttpError(403, "Only system owner can switch companies");
  }

  const [rows] = await pool.query(
    `SELECT id, company_id, email, is_active FROM users WHERE id = :id LIMIT 1`,
    { id: userId }
  );
  if (rows.length === 0 || !rows[0].is_active) throw new HttpError(403, "User inactive");
  
  const u = rows[0];
  const cId = targetCompanyId === "null" || targetCompanyId === null ? null : Number(targetCompanyId);
  
  const accessToken = signAccess({ id: u.id, company_id: cId, email: u.email });
  return { accessToken };
}

export async function me(userId) {
  const [rows] = await pool.query(
    `
    SELECT id, company_id, first_name, last_name, email, display_name
    FROM users
    WHERE id = :id
    LIMIT 1
    `,
    { id: userId }
  );
  if (rows.length === 0) throw new HttpError(404, "Not found");

  const user = rows[0];
  const roles = await getUserRoles(userId);
  const permissions = await getUserPermissions(userId);

  return { user, roles, permissions };
}

