/**
 * scripts/init-db.js — Initialisation directe SQLite via @libsql/client
 * 
 * Crée toutes les tables du schéma et insère le compte administrateur.
 * Utilisé au premier démarrage de l'application installée.
 * Bypass complet de Prisma CLI (pas de db push, pas de migrate).
 */

const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Resolve DB path: use env var or default relative to app directory
const APP_DIR = path.resolve(__dirname, '..');
const defaultDbPath = 'file:' + path.join(APP_DIR, 'data', 'inci-card.db').replace(/\\/g, '/');
const DB_URL = process.env.DATABASE_URL || defaultDbPath;

console.log('[init-db] DB URL:', DB_URL);

const { createClient } = require('@libsql/client');

async function main() {
  const db = createClient({ url: DB_URL });

  // =========================================
  // 1. CREATE TABLES (IF NOT EXISTS)
  // =========================================
  console.log('[init-db] Creating tables...');

  const statements = [
    // SyncQueue
    `CREATE TABLE IF NOT EXISTS "SyncQueue" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "payload" TEXT NOT NULL,
      "timestamp" INTEGER NOT NULL,
      "description" TEXT NOT NULL,
      "retryCount" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    // SyncCursor
    `CREATE TABLE IF NOT EXISTS "SyncCursor" (
      "tableName" TEXT NOT NULL PRIMARY KEY,
      "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    // CustomRole
    `CREATE TABLE IF NOT EXISTS "CustomRole" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT,
      "color" TEXT NOT NULL DEFAULT '#6366f1',
      "isSystem" INTEGER NOT NULL DEFAULT 0,
      "permissions" TEXT NOT NULL DEFAULT '{}',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CustomRole_name_key" ON "CustomRole"("name")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CustomRole_slug_key" ON "CustomRole"("slug")`,

    // User
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "login" TEXT,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "firstName" TEXT,
      "phone" TEXT,
      "role" TEXT NOT NULL DEFAULT 'OPERATEUR',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_login_key" ON "User"("login")`,

    // Company
    `CREATE TABLE IF NOT EXISTS "Company" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "identifierPrefix" TEXT,
      "isLocked" INTEGER NOT NULL DEFAULT 0,
      "isLaserEnabled" INTEGER NOT NULL DEFAULT 0,
      "protectAppModified" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Company_name_key" ON "Company"("name")`,

    // Employee
    `CREATE TABLE IF NOT EXISTS "Employee" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "dynamicData" TEXT NOT NULL,
      "uniqueIdentifier" TEXT NOT NULL,
      "photoUrl" TEXT,
      "photoHash" TEXT,
      "photoConflict" INTEGER NOT NULL DEFAULT 0,
      "enrollmentNumber" TEXT,
      "cardNumber" TEXT,
      "status" TEXT NOT NULL DEFAULT 'A_ENROLER',
      "isLocked" INTEGER NOT NULL DEFAULT 0,
      "isBlocked" INTEGER NOT NULL DEFAULT 0,
      "appModified" INTEGER NOT NULL DEFAULT 0,
      "printCount" INTEGER NOT NULL DEFAULT 0,
      "version" INTEGER NOT NULL DEFAULT 0,
      "printedAt" DATETIME,
      "enrolledBy" TEXT,
      "printedBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deliveryBatchId" TEXT,
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
      FOREIGN KEY ("deliveryBatchId") REFERENCES "DeliveryBatch"("id") ON DELETE SET NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Employee_companyId_uniqueIdentifier_key" ON "Employee"("companyId", "uniqueIdentifier")`,

    // CardTemplate
    `CREATE TABLE IF NOT EXISTS "CardTemplate" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'BADGE',
      "categoryId" TEXT,
      "width" INTEGER NOT NULL DEFAULT 324,
      "height" INTEGER NOT NULL DEFAULT 204,
      "backgroundUrl" TEXT,
      "layoutConfig" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
      FOREIGN KEY ("categoryId") REFERENCES "CardCategory"("id") ON DELETE SET NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CardTemplate_companyId_type_categoryId_key" ON "CardTemplate"("companyId", "type", "categoryId")`,

    // CardFormat
    `CREATE TABLE IF NOT EXISTS "CardFormat" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "width" REAL NOT NULL DEFAULT 85.6,
      "height" REAL NOT NULL DEFAULT 53.98,
      "unit" TEXT NOT NULL DEFAULT 'mm',
      "companyId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CardFormat_companyId_name_key" ON "CardFormat"("companyId", "name")`,

    // CardCategory
    `CREATE TABLE IF NOT EXISTS "CardCategory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "color" TEXT NOT NULL DEFAULT '#6366f1',
      "description" TEXT,
      "validityValue" INTEGER DEFAULT 1,
      "validityUnit" TEXT DEFAULT 'YEAR',
      "formatId" TEXT NOT NULL,
      "companyId" TEXT,
      "documentTypeSlug" TEXT DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("formatId") REFERENCES "CardFormat"("id") ON DELETE RESTRICT,
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CardCategory_companyId_name_key" ON "CardCategory"("companyId", "name")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CardCategory_companyId_slug_key" ON "CardCategory"("companyId", "slug")`,

    // CardPhysicalType
    `CREATE TABLE IF NOT EXISTS "CardPhysicalType" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT,
      "cardCode" TEXT NOT NULL DEFAULT '',
      "companyId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CardPhysicalType_companyId_name_key" ON "CardPhysicalType"("companyId", "name")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CardPhysicalType_companyId_slug_key" ON "CardPhysicalType"("companyId", "slug")`,

    // DeliveryBatch
    `CREATE TABLE IF NOT EXISTS "DeliveryBatch" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "batchNumber" TEXT,
      "companyId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PREPARE',
      "shippedAt" DATETIME,
      "deliveredAt" DATETIME,
      "signedProof" TEXT,
      "signedProofName" TEXT,
      "signedProofType" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryBatch_batchNumber_key" ON "DeliveryBatch"("batchNumber")`,

    // CardDocumentType
    `CREATE TABLE IF NOT EXISTS "CardDocumentType" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT,
      "cardCode" TEXT NOT NULL DEFAULT '',
      "companyId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CardDocumentType_companyId_name_key" ON "CardDocumentType"("companyId", "name")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CardDocumentType_companyId_slug_key" ON "CardDocumentType"("companyId", "slug")`,

    // PrintJob
    `CREATE TABLE IF NOT EXISTS "PrintJob" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "employeeId" TEXT NOT NULL,
      "cardNumber" TEXT NOT NULL,
      "templateType" TEXT NOT NULL,
      "categoryId" TEXT,
      "physicalTypeId" TEXT,
      "isReprint" INTEGER NOT NULL DEFAULT 0,
      "reprintReason" TEXT,
      "printedBy" TEXT NOT NULL,
      "printedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE
    )`,
  ];

  for (const sql of statements) {
    try {
      await db.execute(sql);
    } catch (e) {
      console.error('[init-db] Error executing:', sql.substring(0, 60) + '...');
      console.error('[init-db]', e.message);
    }
  }
  console.log('[init-db] Tables created.');

  // =========================================
  // 2. SEED ADMIN USER
  // =========================================
  console.log('[init-db] Creating admin user...');
  const passwordHash = await bcrypt.hash('admin123', 10);

  const existing = await db.execute({
    sql: 'SELECT id FROM "User" WHERE email = ?',
    args: ['admin@imprimerie.fr']
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE "User" SET login = ?, "passwordHash" = ?, role = ? WHERE email = ?',
      args: ['admin', passwordHash, 'ADMIN', 'admin@imprimerie.fr']
    });
    console.log('[init-db] Admin user updated.');
  } else {
    const id = crypto.randomUUID();
    await db.execute({
      sql: 'INSERT INTO "User" (id, email, login, name, "passwordHash", role) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, 'admin@imprimerie.fr', 'admin', 'Administrateur', passwordHash, 'ADMIN']
    });
    console.log('[init-db] Admin user created.');
  }

  // =========================================
  // 3. VERIFY
  // =========================================
  const users = await db.execute('SELECT id, email, login, role FROM "User"');
  console.log('[init-db] Users:', users.rows);

  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('[init-db] Tables:', tables.rows.map(r => r.name));

  console.log('[init-db] Done!');
}

main().catch(e => {
  console.error('[init-db] FATAL:', e.message);
  process.exit(1);
});
