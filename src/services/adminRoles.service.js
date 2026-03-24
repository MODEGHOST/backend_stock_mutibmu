import { pool, withTx } from "../config/db.js";
import HttpError from "../utils/httpError.js";

// List all roles available to the company (including global roles)
export async function listCompanyRoles(userId, companyId) {
  // Check if current user is system_owner
  const [isAdmin] = await pool.query(
    `SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = :userId AND r.code = 'system_owner' LIMIT 1`,
    { userId }
  );
  const isSystemOwner = isAdmin.length > 0;

  const [rows] = await pool.query(
    `
    SELECT id, code, name, is_system, is_active, company_id
    FROM roles
    WHERE (company_id = :companyId OR (company_id IS NULL AND code = 'system_owner'))
      AND is_active = 1
      ${!isSystemOwner ? "AND code != 'system_owner'" : ""}
    ORDER BY 
      CASE code 
        WHEN 'system_owner' THEN 1
        WHEN 'company_owner' THEN 2
        WHEN 'company_admin' THEN 3
        WHEN 'company_manage' THEN 4
        WHEN 'company_user' THEN 5
        ELSE 99 
      END ASC,
      id DESC
    `,
    { companyId }
  );

  return { rows };
}

// Create custom role for a company
export async function createCompanyRole(companyId, body) {
  const { code, name } = body;
  
  // ensure code is unique or just generate a unique code per company
  const finalCode = code || `role_${companyId}_${Date.now()}`;

  const [r] = await pool.query(
    `
    INSERT INTO roles (company_id, code, name, is_system, is_active, created_at)
    VALUES (:companyId, :code, :name, 0, 1, NOW())
    `,
    { companyId, code: finalCode, name }
  );

  return { id: r.insertId, code: finalCode, name };
}

export async function updateCompanyRole(companyId, roleId, body) {
  const { name } = body;
  
  // Only allow updating roles that belong specifically to this company
  const [r] = await pool.query(
    `
    UPDATE roles
    SET name = :name
    WHERE id = :roleId AND company_id = :companyId AND is_system = 0
    `,
    { name, roleId, companyId }
  );

  if (r.affectedRows === 0) {
    throw new HttpError(404, "Role not found or cannot edit global/system roles");
  }

  return { ok: true };
}

export async function deleteCompanyRole(companyId, roleId) {
  // Only allow deleting roles that belong specifically to this company
  // Note: We might want to clear user_roles first, or rely on ON DELETE CASCADE.
  // Assuming ON DELETE CASCADE is set up or we can manual delete.
  return await withTx(async (conn) => {
    // Check if role exists and belongs to company
    const [roles] = await conn.query(
      `SELECT id FROM roles WHERE id = :roleId AND company_id = :companyId AND is_system = 0`,
      { roleId, companyId }
    );
    if (!roles.length) throw new HttpError(404, "Role not found or cannot delete global/system roles");

    // Delete mappings
    await conn.query(`DELETE FROM user_roles WHERE role_id = :roleId`, { roleId });
    await conn.query(`DELETE FROM role_permissions WHERE role_id = :roleId`, { roleId });
    
    // Delete role
    const [r] = await conn.query(`DELETE FROM roles WHERE id = :roleId`, { roleId });
    
    return { ok: true };
  });
}

// Permissions list
export async function listAllPermissions() {
  const [rows] = await pool.query(
    `
    SELECT id, code, name, module
    FROM permissions
    ORDER BY module ASC, id ASC
    `
  );
  return { rows };
}

export async function getRolePermissions(companyId, roleId) {
  const [roles] = await pool.query(
    `SELECT id FROM roles WHERE id = :roleId AND (company_id = :companyId OR company_id IS NULL)`,
    { roleId, companyId }
  );
  if (!roles.length) throw new HttpError(404, "Role not found");

  const [perms] = await pool.query(
    `
    SELECT permission_id 
    FROM role_permissions
    WHERE role_id = :roleId
    `,
    { roleId }
  );

  return { permission_ids: perms.map((p) => p.permission_id) };
}

export async function setRolePermissions(userId, companyId, roleId, permissionIds) {
  return await withTx(async (conn) => {
    // Check if current user is system_owner
    const [isAdmin] = await conn.query(
      `SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = :userId AND r.code = 'system_owner' LIMIT 1`,
      { userId }
    );
    const isSystemOwner = isAdmin.length > 0;

    const [roles] = await conn.query(
      `SELECT id, company_id FROM roles WHERE id = :roleId AND (company_id = :companyId OR company_id IS NULL)`,
      { roleId, companyId }
    );
    if (!roles.length) throw new HttpError(404, "Role not found");

    if (roles[0].company_id === null && !isSystemOwner) {
      throw new HttpError(403, "ไม่อนุญาตให้แก้ไข Role ต้นแบบ (Global Template) ผ่าน API ครับ");
    }

    const validIds = Array.from(new Set((permissionIds || []).map(Number).filter(Boolean)));

    await conn.query(`DELETE FROM role_permissions WHERE role_id = :roleId`, { roleId });

    for (const pid of validIds) {
      await conn.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id, created_at) VALUES (:roleId, :pid, NOW())`,
        { roleId, pid }
      );
    }

    return { ok: true };
  });
}
