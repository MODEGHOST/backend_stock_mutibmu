import mysql from 'mysql2/promise';

async function test() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'stockoffice_multibmu',
  });
  
  try {
     const [p] = await pool.query('DESCRIBE permissions');
     const [rp] = await pool.query('DESCRIBE role_permissions');
     console.log("permissions:", p);
     console.log("role_permissions:", rp);
  } catch(e) { console.error(e) }
  process.exit(0);
}

test();
