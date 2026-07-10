const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://inci:N0WJ066W8Ir8SjGxCUWl42VZBJ7bTjfx@dpg-d8v6v98js32c738ogv2g-a.oregon-postgres.render.com/incicarddb?sslmode=require'
  });
  await client.connect();

  // Find company of SIGNO
  const empRes = await client.query('SELECT "companyId" FROM "Employee" WHERE id = \'8a5724f9-25a1-4bc1-b834-bab51b2c1c22\'');
  const companyId = empRes.rows[0].companyId;

  // Print all employees of this company
  const res = await client.query('SELECT id, "dynamicData", "cardNumber" FROM "Employee" WHERE "companyId" = $1', [companyId]);
  console.log('Employees of INCI:');
  res.rows.forEach(m => {
    console.log(m.id, `| card: "${m.cardNumber}" | dynamicData: ${JSON.stringify(m.dynamicData)}`);
  });

  await client.end();
}
main().catch(console.error);
