import { pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";

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

export async function listProducts(companyId) {
  const [rows] = await pool.query(
    `SELECT id, company_id, code, name, unit, sell_price, is_active, is_vat,
            created_at, updated_at
     FROM products
     WHERE company_id=:companyId
     ORDER BY id DESC`,
    { companyId }
  );
  return rows;
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

export async function createProduct(companyId, data) {
  const code = data.code || await generateProductCode(companyId);
  await ensureCodeUnique(companyId, code);

  const [r] = await pool.query(
    `INSERT INTO products
     (company_id, code, name, unit, sell_price, is_active, is_vat)
     VALUES
     (:company_id, :code, :name, :unit, :sell_price, :is_active, :is_vat)`,
    {
      company_id: companyId,
      code,
      name: data.name,
      unit: data.unit ?? null,
      sell_price: data.sell_price ?? 0,
      is_active: data.is_active ?? 1,
      is_vat: data.is_vat ?? 1,
    }
  );
  return r.insertId;
}

export async function updateProduct(companyId, id, data) {
  await ensureCodeUnique(companyId, data.code, id);

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
}

export async function setProductActive(companyId, id, is_active) {
  const [r] = await pool.query(
    `UPDATE products SET is_active=:is_active
     WHERE id=:id AND company_id=:companyId`,
    { id, companyId, is_active }
  );
  if (!r.affectedRows) throw new HttpError(404, "Not found");
}
