import { pool } from "../src/config/db.js";

async function run() {
  console.log("Starting Tenant Roles Migration...");

  // Get all companies
  const [companies] = await pool.query(`SELECT id, name FROM companies`);
  
  // Get all global roles except system_owner
  const [globalRoles] = await pool.query(`SELECT * FROM roles WHERE company_id IS NULL AND code != 'system_owner'`);

  for (const company of companies) {
    console.log(`Migrating Company: ${company.name} (ID: ${company.id})`);
    
    for (const gRole of globalRoles) {
      // Check if this company already has a local copy of this role
      const [existing] = await pool.query(
        `SELECT id FROM roles WHERE company_id = ? AND code = ?`,
        [company.id, gRole.code]
      );

      let localRoleId;

      if (existing.length === 0) {
        // Create local role
        const [ins] = await pool.query(
          `INSERT INTO roles (company_id, code, name, is_system, is_active, created_at)
           VALUES (?, ?, ?, 0, 1, NOW())`,
          [company.id, gRole.code, gRole.name]
        );
        localRoleId = ins.insertId;

        // Copy permissions
        const [perms] = await pool.query(`SELECT permission_id FROM role_permissions WHERE role_id = ?`, [gRole.id]);
        for (const p of perms) {
          await pool.query(`INSERT INTO role_permissions (role_id, permission_id, created_at) VALUES (?, ?, NOW())`, [localRoleId, p.permission_id]);
        }
        console.log(`  - Created local role: ${gRole.name} (ID: ${localRoleId})`);
      } else {
        localRoleId = existing[0].id;
      }

      // Re-map users in this company who have the global role to the new local role
      const [uRoles] = await pool.query(`
        SELECT ur.user_id 
        FROM user_roles ur
        JOIN users u ON u.id = ur.user_id
        WHERE ur.role_id = ? AND u.company_id = ?
      `, [gRole.id, company.id]);

      for (const ur of uRoles) {
        // Delete global assignment
        await pool.query(`DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`, [ur.user_id, gRole.id]);
        // Insert local assignment
        await pool.query(`INSERT IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, NOW())`, [ur.user_id, localRoleId]);
        console.log(`  - Migrated User ID ${ur.user_id} to local role ${gRole.name}`);
      }
    }
  }

  console.log("Migration completed successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
