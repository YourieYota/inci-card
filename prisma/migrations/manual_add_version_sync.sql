-- Migration manuelle : ajout des colonnes 'version' et des tables de sync
-- À appliquer sur le PostgreSQL Render SANS réinitialiser les données
-- Exécuter avec : psql DATABASE_URL -f prisma/migrations/manual_add_version_sync.sql

-- 1. Colonne version sur Employee (0 par défaut pour les existants)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- 2. Colonne version sur Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- 3. Colonne version sur CustomRole
ALTER TABLE "CustomRole" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- 4. Colonne version sur CardTemplate
ALTER TABLE "CardTemplate" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- 5. Colonne version sur User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- 6. Table SyncQueue (file de mutations)
CREATE TABLE IF NOT EXISTS "SyncQueue" (
    "id"          TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "payload"     JSONB NOT NULL,
    "timestamp"   BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "retryCount"  INTEGER NOT NULL DEFAULT 0,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncQueue_pkey" PRIMARY KEY ("id")
);

-- 7. Table SyncCursor (curseur de sync descendante par table)
CREATE TABLE IF NOT EXISTS "SyncCursor" (
    "tableName"   TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("tableName")
);

-- Vérification
SELECT 
  'Employee.version' as check, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Employee' AND column_name = 'version'
UNION ALL
SELECT 
  'SyncQueue exists', table_name, 'table'
FROM information_schema.tables 
WHERE table_name = 'SyncQueue';
