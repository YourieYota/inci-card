const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  console.log("Testing pg Pool connection...");
  const connectionString = process.env.DATABASE_URL + "&uselibpqcompat=true";
  console.log("Connection string:", connectionString);
  const pool = new Pool({ connectionString });
  
  try {
    const res = await pool.query('SELECT NOW()');
    console.log("Connected successfully. Time:", res.rows[0].now);
  } catch (e) {
    console.error("Connection failed:", e);
  } finally {
    await pool.end();
  }
}
main();
