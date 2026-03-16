import "dotenv/config";
import mysql from "mysql2/promise";

async function check() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "stockoffice_multibmu",
    });

    console.log("Connected to DB.");

    const [companies] = await conn.query("SELECT id, name FROM companies");
    console.log("Companies:", companies);

    const [configs] = await conn.query("SELECT * FROM company_doc_configs");
    console.log("Doc Configs:", configs);

    await conn.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
