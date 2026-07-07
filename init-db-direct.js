const { createClient } = require('@libsql/client');
const bcrypt = require('bcrypt');

const DB_PATH = 'file:C:/Program Files/INCI-Card/app/data/inci-card.db';

async function main() {
  const db = createClient({ url: DB_PATH });

  // 1. Create all tables
  console.log('[1/4] Creating tables...');
  
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      "email" TEXT NOT NULL,
      "login" TEXT,
      "name" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'VIEWER',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 1,
      "lastModifiedBy" TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
    CREATE UNIQUE INDEX IF NOT EXISTS "User_login_key" ON "User"("login");

    CREATE TABLE IF NOT EXISTS "Company" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      "name" TEXT NOT NULL,
      "address" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "logoUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 1,
      "lastModifiedBy" TEXT
    );

    CREATE TABLE IF NOT EXISTS "Employee" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "position" TEXT,
      "department" TEXT,
      "employeeId" TEXT,
      "photoUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "companyId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 1,
      "lastModifiedBy" TEXT,
      CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "CardTemplate" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      "name" TEXT NOT NULL,
      "designData" TEXT NOT NULL,
      "companyId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CardTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "PrintJob" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "copies" INTEGER NOT NULL DEFAULT 1,
      "employeeId" TEXT NOT NULL,
      "templateId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 1,
      "lastModifiedBy" TEXT,
      CONSTRAINT "PrintJob_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "PrintJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CardTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "DeliveryBatch" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      "batchNumber" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PREPARING',
      "companyId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 1,
      "lastModifiedBy" TEXT,
      CONSTRAINT "DeliveryBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryBatch_batchNumber_key" ON "DeliveryBatch"("batchNumber");

    CREATE TABLE IF NOT EXISTS "DeliveryBatchItem" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      "batchId" TEXT NOT NULL,
      "printJobId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DeliveryBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DeliveryBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "DeliveryBatchItem_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "PrintJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "SyncQueue" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "payload" TEXT NOT NULL,
      "timestamp" INTEGER NOT NULL,
      "description" TEXT NOT NULL,
      "retryCount" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "SyncCursor" (
      "tableName" TEXT NOT NULL PRIMARY KEY,
      "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('    Tables created.');

  // 2. Seed admin user
  console.log('[2/4] Creating admin user...');
  const passwordHash = await bcrypt.hash('admin123', 10);

  // Check if admin exists
  const existing = await db.execute({
    sql: 'SELECT id FROM "User" WHERE email = ?',
    args: ['admin@imprimerie.fr']
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE "User" SET login = ?, "passwordHash" = ? WHERE email = ?',
      args: ['admin', passwordHash, 'admin@imprimerie.fr']
    });
    console.log('    Admin user updated.');
  } else {
    const id = require('crypto').randomUUID();
    await db.execute({
      sql: 'INSERT INTO "User" (id, email, login, name, "passwordHash", role) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, 'admin@imprimerie.fr', 'admin', 'Administrateur', passwordHash, 'ADMIN']
    });
    console.log('    Admin user created.');
  }

  // 3. Verify
  console.log('[3/4] Verifying...');
  const users = await db.execute('SELECT id, email, login, role FROM "User"');
  console.log('    Users in database:', users.rows);

  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('    Tables:', tables.rows.map(r => r.name));

  console.log('[4/4] Done!');
}

main().catch(console.error);
