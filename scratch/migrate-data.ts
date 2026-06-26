import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

const neonUrl = "postgresql://neondb_owner:npg_mz5aUDnVZEA9@ep-little-bonus-ahl2nt4v-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
const renderUrl = "postgresql://inci:N0WJ066W8Ir8SjGxCUWl42VZBJ7bTjfx@dpg-d8v6v98js32c738ogv2g-a.oregon-postgres.render.com/incicarddb?sslmode=require";

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: renderUrl });
const adapter = new PrismaPg(pool);
const targetDb = new PrismaClient({ adapter });

// Connect pg to source (Neon)
const sourceDb = new Client({ connectionString: neonUrl });

async function copyTable(modelName: string, tableName: string) {
  console.log(`Copying ${modelName}...`);
  const res = await sourceDb.query(`SELECT * FROM "${tableName}"`);
  const data = res.rows;
  
  if (data.length === 0) {
    console.log(`- 0 records found for ${modelName}`);
    return;
  }
  
  try {
    const result = await (targetDb as any)[modelName].createMany({
      data: data,
      skipDuplicates: true
    });
    console.log(`- Migrated ${result.count} records for ${modelName} (skipped duplicates).`);
  } catch (error: any) {
    console.error(`- Error migrating ${modelName}:`, error.message);
  }
}

async function main() {
  console.log("Starting database migration...");
  await sourceDb.connect();
  
  // Dependency order: No dependencies first
  await copyTable('customRole', 'CustomRole');
  await copyTable('user', 'User');
  await copyTable('company', 'Company');
  
  // Depend on Company
  await copyTable('cardFormat', 'CardFormat');
  await copyTable('cardPhysicalType', 'CardPhysicalType');
  await copyTable('cardDocumentType', 'CardDocumentType');
  await copyTable('deliveryBatch', 'DeliveryBatch');
  
  // Depend on Format and Company
  await copyTable('cardCategory', 'CardCategory');
  
  // Depend on Category and Company
  await copyTable('cardTemplate', 'CardTemplate');
  
  // Depend on Company and DeliveryBatch
  await copyTable('employee', 'Employee');
  
  // Depend on Employee
  await copyTable('printJob', 'PrintJob');
  
  console.log("Migration complete!");
}

main().catch(console.error).finally(async () => {
  await sourceDb.end();
  await targetDb.$disconnect();
});
