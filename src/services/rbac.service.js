import { pool } from "../config/db.js";

export async function hasPermission(userId, code) {
  const [rows] = await pool.query(
    `
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = :userId 
      AND (r.code = 'system_owner' OR p.code = :code)
    LIMIT 1
    `,
    { userId, code }
  );
  return rows.length > 0;
}

export async function getUserRoles(userId) {
  const [rows] = await pool.query(
    `
    SELECT DISTINCT r.code
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = :userId
    ORDER BY r.code
    `,
    { userId }
  );
  return rows.map(r => r.code);
}

export async function getUserPermissions(userId) {
  const [rows] = await pool.query(
    `
    SELECT DISTINCT p.code
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = :userId
    ORDER BY p.code
    `,
    { userId }
  );
  return rows.map(p => p.code);
}
