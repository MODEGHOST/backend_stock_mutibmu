
import { pool } from "./config/db.js";

async function check() {
  try {
    const [rows] = await pool.query("SELECT id, quotation_no, invoice_no, status FROM sales");
    console.table(rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

check();
