import { pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";

export async function listWarehouses(companyId) {
  const [rows] = await pool.query(
    `SELECT id, company_id, code, name, location, province, district, sub_district, zip_code, description, is_active, created_at, updated_at
     FROM warehouses
     WHERE company_id=:companyId
     ORDER BY id DESC`,
    { companyId }
  );
  return rows;
}

export async function getWarehouse(companyId, id) {
  const [rows] = await pool.query(
    `SELECT id, company_id, code, name, location, province, district, sub_district, zip_code, description, is_active, created_at, updated_at
     FROM warehouses
     WHERE company_id=:companyId AND id=:id
     LIMIT 1`,
    { companyId, id }
  );
  if (rows.length === 0) suggestWarehouseNotFound();
  return rows[0];
}

function suggestWarehouseNotFound() {
  throw new HttpError(404, "Not found");
}

async function ensureCodeUnique(companyId, code, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT id
     FROM warehouses
     WHERE company_id=:companyId AND code=:code
       AND (:excludeId IS NULL OR id <> :excludeId)
     LIMIT 1`,
    { companyId, code, excludeId }
  );
  if (rows.length > 0) throw new HttpError(400, "Warehouse code already exists");
}

export async function createWarehouse(companyId, data) {
  await ensureCodeUnique(companyId, data.code);

  const [r] = await pool.query(
    `INSERT INTO warehouses (company_id, code, name, location, province, district, sub_district, zip_code, description, is_active)
     VALUES (:company_id, :code, :name, :location, :province, :district, :sub_district, :zip_code, :description, :is_active)`,
    {
      company_id: companyId,
      code: data.code,
      name: data.name,
      location: data.location ?? null,
      province: data.province ?? null,
      district: data.district ?? null,
      sub_district: data.sub_district ?? null,
      zip_code: data.zip_code ?? null,
      description: data.description ?? null,
      is_active: data.is_active ?? 1
    }
  );
  return r.insertId;
}

export async function updateWarehouse(companyId, id, data) {
  await ensureCodeUnique(companyId, data.code, id);

  const [r] = await pool.query(
    `UPDATE warehouses
     SET code=:code, name=:name, location=:location, province=:province, district=:district, sub_district=:sub_district, zip_code=:zip_code, description=:description, is_active=:is_active
     WHERE id=:id AND company_id=:companyId`,
    {
      id,
      companyId,
      code: data.code,
      name: data.name,
      location: data.location ?? null,
      province: data.province ?? null,
      district: data.district ?? null,
      sub_district: data.sub_district ?? null,
      zip_code: data.zip_code ?? null,
      description: data.description ?? null,
      is_active: data.is_active ?? 1
    }
  );
  if (r.affectedRows === 0) throw new HttpError(404, "Not found");
}

export async function setWarehouseActive(companyId, id, is_active) {
  const [r] = await pool.query(
    `UPDATE warehouses
     SET is_active=:is_active
     WHERE id=:id AND company_id=:companyId`,
    { is_active, id, companyId }
  );
  if (r.affectedRows === 0) throw new HttpError(404, "Not found");
}
