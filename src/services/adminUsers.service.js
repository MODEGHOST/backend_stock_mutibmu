import bcrypt from "bcrypt";
import { pool, withTx } from "../config/db.js";
import HttpError from "../utils/httpError.js";

// helper
const like = (q) => (q ? `%${q}%` : null);

export async function listCompanyUsers(companyId, { q, limit, offset }) {
  const kw = like(q);

  const [rows] = await pool.query(
    `
    SELECT id, company_id, first_name, last_name, email, phone, display_name, is_active, created_at
    FROM users
    WHERE company_id = :companyId
      AND (:kw IS NULL OR email LIKE :kw OR first_name LIKE :kw OR last_name LIKE :kw)
    ORDER BY id DESC
    LIMIT :limit OFFSET :offset
    `,
    { companyId, kw, limit, offset },
  );

  const [cnt] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM users
    WHERE company_id = :companyId
      AND (:kw IS NULL OR email LIKE :kw OR first_name LIKE :kw OR last_name LIKE :kw)
    `,
    { companyId, kw },
  );

  // roles ของแต่ละ user (optional แต่แนะนำให้ส่งไปหน้า admin)
  const ids = (rows || []).map((r) => Number(r.id));
  let rolesByUser = {};
  if (ids.length) {
    const [rs] = await pool.query(
      `
      SELECT ur.user_id, r.id AS role_id, r.code, r.name
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id IN (:ids)
      `,
      { ids },
    );
    rolesByUser = (rs || []).reduce((acc, x) => {
      const uid = Number(x.user_id);
      acc[uid] = acc[uid] || [];
      acc[uid].push({ id: Number(x.role_id), code: x.code, name: x.name });
      return acc;
    }, {});
  }

  const out = (rows || []).map((u) => ({
    ...u,
    roles: rolesByUser[Number(u.id)] || [],
  }));

  return { rows: out, total: Number(cnt?.[0]?.total || 0) };
}

export async function createCompanyUser(companyId, actorUserId, body) {
  return await withTx(async (conn) => {
    // กัน email ซ้ำ
    const [dup] = await conn.query(
      `SELECT id FROM users WHERE email=:email LIMIT 1`,
      { email: body.email },
    );
    if (dup.length) throw new HttpError(400, "Email already exists");

    const password_hash = await bcrypt.hash(body.password, 10);

    const [r] = await conn.query(
      `
      INSERT INTO users (
        company_id, first_name, last_name, phone, email,
        password_hash, display_name, is_active
      )
      VALUES (
        :company_id, :first_name, :last_name, :phone, :email,
        :password_hash, :display_name, :is_active
      )
      `,
      {
        company_id: companyId,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
        email: body.email,
        password_hash,
        display_name: body.display_name ?? null,
        is_active: body.is_active ? 1 : 0,
      },
    );

    const userId = r.insertId;

    // assign roles (ถ้าส่งมา)
    if (Array.isArray(body.role_ids) && body.role_ids.length) {
      // ต้องเป็น role ของบริษัทเดียวกัน หรือ role กลาง (ถ้าคุณอนุญาต)
      const [roles] = await conn.query(
        `
  SELECT id
  FROM roles
  WHERE id IN (:ids)
    AND is_active = 1
    AND is_system = 0
    AND (company_id = :companyId OR company_id IS NULL)
  `,
        { ids: uniq, companyId },
      );

      if ((roles || []).length !== body.role_ids.length) {
        throw new HttpError(400, "Invalid role_ids");
      }

      for (const rid of body.role_ids) {
        await conn.query(
          `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)`,
          { user_id: userId, role_id: rid },
        );
      }
    }

    return { id: userId };
  });
}

export async function updateCompanyUser(
  companyId,
  actorUserId,
  targetUserId,
  patch,
) {
  return await withTx(async (conn) => {
    const [u] = await conn.query(
      `SELECT id, company_id FROM users WHERE id=:id LIMIT 1 FOR UPDATE`,
      { id: targetUserId },
    );
    if (!u.length) throw new HttpError(404, "User not found");
    if (Number(u[0].company_id) !== Number(companyId))
      throw new HttpError(403, "Forbidden");

    // กันปิด active ตัวเอง
    if (
      Number(actorUserId) === Number(targetUserId) &&
      typeof patch.is_active === "boolean"
    ) {
      if (patch.is_active === false)
        throw new HttpError(400, "Cannot deactivate yourself");
    }

    await conn.query(
      `
      UPDATE users
      SET
        first_name = COALESCE(:first_name, first_name),
        last_name = COALESCE(:last_name, last_name),
        phone = COALESCE(:phone, phone),
        display_name = :display_name,
        is_active = COALESCE(:is_active, is_active),
        updated_at = NOW()
      WHERE id=:id AND company_id=:companyId
      `,
      {
        id: targetUserId,
        companyId,
        first_name: patch.first_name ?? null,
        last_name: patch.last_name ?? null,
        phone: patch.phone ?? null,
        display_name:
          typeof patch.display_name === "undefined" ? null : patch.display_name,
        is_active:
          typeof patch.is_active === "boolean"
            ? patch.is_active
              ? 1
              : 0
            : null,
      },
    );

    return { ok: true };
  });
}

export async function setUserRoles(
  companyId,
  actorUserId,
  targetUserId,
  roleIds,
) {
  return await withTx(async (conn) => {
    const [u] = await conn.query(
      `SELECT id, company_id FROM users WHERE id=:id LIMIT 1 FOR UPDATE`,
      { id: targetUserId },
    );
    if (!u.length) throw new HttpError(404, "User not found");
    if (Number(u[0].company_id) !== Number(companyId))
      throw new HttpError(403, "Forbidden");

    // validate roles
    if (!Array.isArray(roleIds)) roleIds = [];
    const uniq = Array.from(
      new Set(roleIds.map((x) => Number(x)).filter(Boolean)),
    );

    if (uniq.length) {
      const [roles] = await conn.query(
        `
        SELECT id
        FROM roles
        WHERE id IN (:ids)
          AND (company_id = :companyId OR company_id IS NULL)
        `,
        { ids: uniq, companyId },
      );
      if ((roles || []).length !== uniq.length)
        throw new HttpError(400, "Invalid role_ids");
    }

    // replace set
    await conn.query(`DELETE FROM user_roles WHERE user_id=:userId`, {
      userId: targetUserId,
    });
    for (const rid of uniq) {
      await conn.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)`,
        { user_id: targetUserId, role_id: rid },
      );
    }

    // กัน admin เผลอถอด role ตัวเองจนไม่มีสิทธิ์ (optional)
    // (อันนี้ทำต่อได้เมื่อฝั่ง UI พร้อม)

    return { ok: true };
  });
}

export async function resetUserPassword(
  companyId,
  actorUserId,
  targetUserId,
  newPassword,
) {
  return await withTx(async (conn) => {
    const [u] = await conn.query(
      `SELECT id, company_id FROM users WHERE id=:id LIMIT 1 FOR UPDATE`,
      { id: targetUserId },
    );
    if (!u.length) throw new HttpError(404, "User not found");
    if (Number(u[0].company_id) !== Number(companyId))
      throw new HttpError(403, "Forbidden");

    const password_hash = await bcrypt.hash(newPassword, 10);

    await conn.query(
      `
      UPDATE users
      SET
        password_hash = :password_hash,
        updated_at = NOW()
      WHERE id=:id AND company_id=:companyId
      `,
      {
        id: targetUserId,
        companyId,
        password_hash,
      },
    );

    return { ok: true };
  });
}
