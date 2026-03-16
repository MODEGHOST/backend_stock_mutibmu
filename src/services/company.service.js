import { pool as db } from "../config/db.js";

// Get Company Settings & Doc Configs
export async function getCompanySettings(companyId) {
  const [rows] = await db.query(
    "SELECT id, name, tax_id, address, phone, email, is_active FROM companies WHERE id = ?",
    [companyId]
  );
  if (rows.length === 0) return null;
  const company = rows[0];

  const [configs] = await db.query(
    "SELECT * FROM company_doc_configs WHERE company_id = ?",
    [companyId]
  );

  return { ...company, doc_configs: configs };
}

// Update Company Info
export async function updateCompany(companyId, data) {
  await db.query(
    "UPDATE companies SET name=?, tax_id=?, address=?, phone=?, email=? WHERE id=?",
    [data.name, data.tax_id, data.address, data.phone, data.email, companyId]
  );
  return getCompanySettings(companyId);
}

// Update Document Config (Prefix, Reset Policy)
export async function updateDocConfig(companyId, docType, data) {
  // Check if exists
  const [exist] = await db.query(
    "SELECT 1 FROM company_doc_configs WHERE company_id=? AND doc_type=?",
    [companyId, docType]
  );

  if (exist.length === 0) {
    // Insert
    await db.query(
      `INSERT INTO company_doc_configs 
      (company_id, doc_type, prefix, reset_policy, is_enabled) 
      VALUES (?, ?, ?, ?, ?)`,
      [companyId, docType, data.prefix, data.reset_policy || 'MONTHLY', 1]
    );
  } else {
    // Update
    await db.query(
      `UPDATE company_doc_configs 
      SET prefix=?, reset_policy=? 
      WHERE company_id=? AND doc_type=?`,
      [data.prefix, data.reset_policy, companyId, docType]
    );
  }

  return getCompanySettings(companyId);
}
