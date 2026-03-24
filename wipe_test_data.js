import { pool } from "./src/config/db.js";

async function wipeData() {
  try {
    // โต๊ะที่จะไม่ล้างข้อมูล (พวก Config และ Master Data หลักของระบบ)
    const keepTables = [
      'companies', 
      'roles', 
      'permissions', 
      'role_permissions', 
      'doc_configs'
    ]; 
    
    console.log("Fetching all tables in the database...");
    const [rows] = await pool.query("SHOW TABLES");
    const tableKey = Object.keys(rows[0])[0];
    const tables = rows.map(r => r[tableKey]);

    console.log("Disabling strict foreign key checks...");
    await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
    
    // ล้างข้อมูลทุกตารางที่ไม่ได้อยู่ในรายการ Keep
    for (let table of tables) {
      if (!keepTables.includes(table) && table !== 'users' && table !== 'user_roles') {
        console.log(`Truncating table: ${table}...`);
        await pool.query(`TRUNCATE TABLE \`${table}\``);
      }
    }

    console.log("Cleaning non-admin users...");
    await pool.query("DELETE FROM user_roles WHERE user_id NOT IN (SELECT id FROM users WHERE email='admin@company.com')");
    await pool.query("DELETE FROM users WHERE email != 'admin@company.com'");

    console.log("Enabling foreign key checks...");
    await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
    
    console.log("");
    console.log("✅ Wiped all test data successfully!");
    console.log("✅ Admin account (admin@company.com) was preserved.");
    console.log("✅ System is clean and ready for Epic 3 testing.");
  } catch(e) {
    console.error("❌ Failed to wipe data:", e);
  } finally {
    process.exit(0);
  }
}
wipeData();
