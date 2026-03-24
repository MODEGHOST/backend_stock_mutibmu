import { pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";
import { logAudit } from "./audit.service.js";

async function generateProductCode(companyId) {
  const [rows] = await pool.query(
    `SELECT code FROM products
     WHERE company_id=:companyId
     ORDER BY id DESC
     LIMIT 1`,
    { companyId }
  );

  if (rows.length === 0) return "P-0001";

  const last = rows[0].code;
  const num = Number(last.replace(/\D/g, "")) + 1;
  return `P-${String(num).padStart(4, "0")}`;
}

export async function listProducts(companyId, params = {}) {
  const { q, sortKey, sortOrder, limit = 20, page = 1 } = params;

  let baseQuery = `FROM products WHERE company_id = :companyId`;
  const queryParams = { companyId };

  if (q) {
    baseQuery += ` AND (code LIKE :q OR name LIKE :q)`;
    queryParams.q = `%${q}%`;
  }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);

  let orderStr = "ORDER BY id DESC";
  const validSortKeys = ["code", "name", "sell_price", "is_active", "is_vat"];
  if (sortKey && validSortKeys.includes(sortKey)) {
    const dir = sortOrder === "asc" ? "ASC" : "DESC";
    orderStr = `ORDER BY ${sortKey} ${dir}`;
  }

  queryParams.limit = Number(limit) || 20;
  queryParams.offset = (Number(page) - 1) * queryParams.limit;

  const [rows] = await pool.query(
    `SELECT id, company_id, code, name, unit, sell_price, is_active, is_vat,
            created_at, updated_at
     ${baseQuery}
     ${orderStr}
     LIMIT :limit OFFSET :offset`,
    queryParams
  );

  return { rows, total };
}

export async function getProduct(companyId, id) {
  const [rows] = await pool.query(
    `SELECT * FROM products
     WHERE company_id=:companyId AND id=:id
     LIMIT 1`,
    { companyId, id }
  );
  if (!rows.length) throw new HttpError(404, "Not found");
  return rows[0];
}

async function ensureCodeUnique(companyId, code, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT id FROM products
     WHERE company_id=:companyId AND code=:code
     AND (:excludeId IS NULL OR id <> :excludeId)
     LIMIT 1`,
    { companyId, code, excludeId }
  );
  if (rows.length) throw new HttpError(400, "Product code already exists");
}

export async function createProduct(companyId, userId, data) {
  let r;
  let finalCode = data.code;
  let retries = 3;

  while (retries > 0) {
    if (!data.code) {
      finalCode = await generateProductCode(companyId);
    }
    await ensureCodeUnique(companyId, finalCode);

    try {
      [r] = await pool.query(
        `INSERT INTO products
         (company_id, code, name, unit, sell_price, is_active, is_vat)
         VALUES
         (:company_id, :code, :name, :unit, :sell_price, :is_active, :is_vat)`,
        {
          company_id: companyId,
          code: finalCode,
          name: data.name,
          unit: data.unit ?? null,
          sell_price: data.sell_price ?? 0,
          is_active: data.is_active ?? 1,
          is_vat: data.is_vat ?? 1,
        }
      );
      break; // Success! Break out of retry loop.
    } catch (err) {
      // If error is ER_DUP_ENTRY and we auto-generated the code, we retry generating it.
      if (err.code === "ER_DUP_ENTRY" && !data.code) {
        retries--;
        if (retries === 0) throw new HttpError(400, "Too many concurrent requests. Failed to generate unique product code.");
        continue;
      }
      throw err; // Other errors surface immediately
    }
  }

  await logAudit({
    companyId,
    userId,
    action: "CREATE",
    entityType: "PRODUCT",
    entityId: r.insertId,
    newValues: { code: finalCode, name: data.name, unit: data.unit, sell_price: data.sell_price }
  });

  return r.insertId;
}

export async function updateProduct(companyId, userId, id, data) {
  await ensureCodeUnique(companyId, data.code, id);

  const [oldRows] = await pool.query(`SELECT * FROM products WHERE id=:id AND company_id=:companyId`, { id, companyId });
  if (!oldRows.length) throw new HttpError(404, "Not found");
  const oldValues = oldRows[0];

  const [r] = await pool.query(
    `UPDATE products SET
      code=:code,
      name=:name,
      unit=:unit,
      sell_price=:sell_price,
      is_active=:is_active,
      is_vat=:is_vat
     WHERE id=:id AND company_id=:companyId`,
    {
      id,
      companyId,
      code: data.code,
      name: data.name,
      unit: data.unit ?? null,
      sell_price: data.sell_price ?? 0,
      is_active: data.is_active ?? 1,
      is_vat: data.is_vat ?? 1,
    }
  );

  if (!r.affectedRows) throw new HttpError(404, "Not found");

  await logAudit({
    companyId,
    userId,
    action: "UPDATE",
    entityType: "PRODUCT",
    entityId: id,
    oldValues,
    newValues: { code: data.code, name: data.name, unit: data.unit, sell_price: data.sell_price, is_active: data.is_active, is_vat: data.is_vat }
  });
}

export async function setProductActive(companyId, userId, id, is_active) {
  const [oldRows] = await pool.query(`SELECT is_active FROM products WHERE id=:id AND company_id=:companyId`, { id, companyId });
  if (!oldRows.length) throw new HttpError(404, "Not found");

  const [r] = await pool.query(
    `UPDATE products SET is_active=:is_active
     WHERE id=:id AND company_id=:companyId`,
    { id, companyId, is_active }
  );
  if (!r.affectedRows) throw new HttpError(404, "Not found");

  await logAudit({
    companyId,
    userId,
    action: "UPDATE",
    entityType: "PRODUCT",
    entityId: id,
    oldValues: { is_active: oldRows[0].is_active },
    newValues: { is_active }
  });
}
