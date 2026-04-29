import { pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";
import { logAudit } from "./audit.service.js";

let productUnitsTableReady = false;

function normalizeUnit(unit) {
  const value = String(unit ?? "").trim();
  return value || null;
}

function normalizeProductName(name) {
  const value = String(name ?? "").trim();
  return value || null;
}

async function ensureProductUnitsTable() {
  if (productUnitsTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_units (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_product_units_company_name (company_id, name),
      KEY idx_product_units_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  productUnitsTableReady = true;
}

export async function listProductUnits(companyId, params = {}) {
  await ensureProductUnitsTable();

  const q = normalizeUnit(params.q);
  const queryParams = { companyId };
  let unitWhere = `WHERE company_id=:companyId`;
  let productWhere = `WHERE company_id=:companyId AND unit IS NOT NULL AND TRIM(unit) <> ''`;

  if (q) {
    unitWhere += ` AND name LIKE :q`;
    productWhere += ` AND unit LIKE :q`;
    queryParams.q = `%${q}%`;
  }

  const [unitRows] = await pool.query(
    `SELECT id, name
     FROM product_units
     ${unitWhere}
     ORDER BY name ASC
     LIMIT 100`,
    queryParams
  );

  const [productRows] = await pool.query(
    `SELECT 0 AS id, TRIM(unit) AS name
     FROM products
     ${productWhere}
     ORDER BY TRIM(unit) ASC
     LIMIT 500`,
    queryParams
  );

  const map = new Map();
  for (const row of [...unitRows, ...productRows]) {
    const name = normalizeUnit(row.name);
    if (!name || map.has(name)) continue;
    map.set(name, { id: row.id || 0, name });
  }

  return Array.from(map.values())
    .sort((a, b) => a.name.localeCompare(b.name, "th"))
    .slice(0, 100);
}

export async function upsertProductUnit(companyId, unit) {
  const name = normalizeUnit(unit);
  if (!name) return null;

  await ensureProductUnitsTable();
  await pool.query(
    `INSERT INTO product_units (company_id, name)
     VALUES (:companyId, :name)
     ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)`,
    { companyId, name }
  );

  return name;
}

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

export async function getNextProductCode(companyId) {
  return generateProductCode(companyId);
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

async function ensureNameUnique(companyId, name, excludeId = null) {
  const normalizedName = normalizeProductName(name);
  if (!normalizedName) throw new HttpError(400, "Product name is required");

  const [rows] = await pool.query(
    `SELECT id, name FROM products
     WHERE company_id=:companyId AND TRIM(name)=:name
     AND (:excludeId IS NULL OR id <> :excludeId)
     LIMIT 1`,
    { companyId, name: normalizedName, excludeId }
  );

  if (rows.length) {
    throw new HttpError(400, `มีสินค้า "${normalizedName}" อยู่ในคลังสินค้าแล้ว กรุณาตรวจสอบ ใหม่อีกครั้ง`);
  }
}

export async function createProduct(companyId, userId, data) {
  let r;
  let finalCode = data.code;
  const name = normalizeProductName(data.name);
  await ensureNameUnique(companyId, name);
  const unit = await upsertProductUnit(companyId, data.unit);
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
          name,
          unit,
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
    newValues: { code: finalCode, name, unit, sell_price: data.sell_price }
  });

  return r.insertId;
}

export async function updateProduct(companyId, userId, id, data) {
  await ensureCodeUnique(companyId, data.code, id);
  const name = normalizeProductName(data.name);
  await ensureNameUnique(companyId, name, id);
  const unit = await upsertProductUnit(companyId, data.unit);

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
      name,
      unit,
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
    newValues: { code: data.code, name, unit, sell_price: data.sell_price, is_active: data.is_active, is_vat: data.is_vat }
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
