import { pool } from "./src/config/db.js";

async function checkDb() {
  try {
    console.log("Checking finance_transactions...");
    const [ft] = await pool.query('DESCRIBE finance_transactions');
    console.log("finance_transactions cols:", ft.map(c => c.Field));
    
    console.log("Checking commission_payments...");
    const [cp] = await pool.query('DESCRIBE commission_payments');
    console.log("commission_payments cols:", cp.map(c => c.Field));
  } catch (err) {
    console.error("DB Check Error:", err);
  } finally {
    process.exit(0);
  }
}
checkDb();
