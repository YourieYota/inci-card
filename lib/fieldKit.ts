import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { generateTableInserts, toSqlValue } from '@/lib/sqlDump';

// Kit terrain : script SQL autonome qui recrée entièrement la base du PC terrain
// (structure + entreprises choisies + comptes) et y active le mode terrain.
// Il s'installe avec scripts/installer-kit-terrain.ps1.

// Refuse l'installation sur une base qui n'a pas été créée par un kit (ex. le serveur principal)
// ou qui contient encore des fiches terrain non exportées.
const INSTALL_GUARD_SQL = `
DO $$
DECLARE
  emp_count bigint := 0;
  kit jsonb;
  mode jsonb;
  since_ts timestamptz;
  pending bigint := 0;
BEGIN
  IF to_regclass('public."Employee"') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM "Employee"' INTO emp_count;
  END IF;
  IF emp_count = 0 THEN
    RETURN;
  END IF;

  IF to_regclass('public."AppSetting"') IS NOT NULL THEN
    EXECUTE 'SELECT value FROM "AppSetting" WHERE key = ''fieldKit''' INTO kit;
    EXECUTE 'SELECT value FROM "AppSetting" WHERE key = ''fieldMode''' INTO mode;
  END IF;

  IF kit IS NULL THEN
    RAISE EXCEPTION 'Installation refusée : cette base contient % employé(s) et n''a pas été créée par un kit terrain. Ce n''est probablement pas le PC terrain.', emp_count;
  END IF;

  IF mode IS NOT NULL AND COALESCE((mode->>'enabled')::boolean, false) THEN
    since_ts := GREATEST((mode->>'since')::timestamptz, COALESCE((mode->>'lastExportAt')::timestamptz, (mode->>'since')::timestamptz));
    EXECUTE 'SELECT count(*) FROM "Employee" WHERE "updatedAt" > $1' INTO pending USING (since_ts AT TIME ZONE 'UTC');
    IF pending > 0 THEN
      RAISE EXCEPTION 'Installation refusée : % fiche(s) terrain n''ont pas été exportées. Exportez les données terrain avant d''installer un nouveau kit.', pending;
    END IF;
  END IF;
END $$;
`;

export async function buildFieldKitSql(companyIds: string[], exportedBy: string) {
  if (!companyIds.length) {
    throw new Error('Sélectionnez au moins une entreprise.');
  }

  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error('Fichier prisma/schema.sql introuvable : impossible de générer la structure de la base.');
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  const inCompanies = { in: companyIds };
  const sharedOrCompany = { OR: [{ companyId: null }, { companyId: inCompanies }] };

  const [companies, customRoles, users, cardTemplates, deliveryBatches, employees, physicalTypes, documentTypes] =
    await Promise.all([
      prisma.company.findMany({ where: { id: inCompanies } }),
      prisma.customRole.findMany(),
      prisma.user.findMany(),
      prisma.cardTemplate.findMany({ where: { companyId: inCompanies } }),
      prisma.deliveryBatch.findMany({ where: { companyId: inCompanies } }),
      prisma.employee.findMany({ where: { companyId: inCompanies } }),
      prisma.cardPhysicalType.findMany({ where: sharedOrCompany }),
      prisma.cardDocumentType.findMany({ where: sharedOrCompany }),
    ]);

  if (companies.length !== companyIds.length) {
    throw new Error('Une ou plusieurs entreprises sélectionnées sont introuvables.');
  }

  // Catégories et formats : ceux des entreprises, les partagés, et ceux référencés par les gabarits
  const templateCategoryIds = cardTemplates.map(t => t.categoryId).filter((id): id is string => !!id);
  const cardCategories = await prisma.cardCategory.findMany({
    where: { OR: [...sharedOrCompany.OR, { id: { in: templateCategoryIds } }] },
  });
  const cardFormats = await prisma.cardFormat.findMany({
    where: { OR: [...sharedOrCompany.OR, { id: { in: cardCategories.map(c => c.formatId) } }] },
  });

  const exportedAt = new Date().toISOString();
  const kitInfo = {
    kitId: crypto.randomUUID(),
    exportedAt,
    exportedBy,
    companies: companies.map(c => ({ id: c.id, name: c.name })),
    employeeCount: employees.length,
  };

  const sql =
    `-- ============================================================\n` +
    `-- INCI CARD - KIT TERRAIN\n` +
    `-- Généré le : ${exportedAt} par ${kitInfo.exportedBy}\n` +
    `-- Entreprises : ${companies.map(c => c.name).join(', ')}\n` +
    `-- À installer UNIQUEMENT sur le PC terrain avec scripts/installer-kit-terrain.ps1\n` +
    `-- ATTENTION : ce script efface entièrement la base sur laquelle il est exécuté.\n` +
    `-- ============================================================\n\n` +
    `SET client_encoding = 'UTF8';\n` +
    `BEGIN;\n` +
    INSTALL_GUARD_SQL + `\n` +
    `DROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\n\n` +
    schemaSql + `\n\n` +
    generateTableInserts('CustomRole', customRoles) +
    generateTableInserts('User', users) +
    generateTableInserts('Company', companies) +
    generateTableInserts('CardFormat', cardFormats) +
    generateTableInserts('CardPhysicalType', physicalTypes) +
    generateTableInserts('CardDocumentType', documentTypes) +
    generateTableInserts('CardCategory', cardCategories) +
    generateTableInserts('CardTemplate', cardTemplates) +
    generateTableInserts('DeliveryBatch', deliveryBatches) +
    generateTableInserts('Employee', employees) +
    `-- Activation du mode terrain (après l'insertion des fiches existantes)\n` +
    `INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES ('fieldKit', ${toSqlValue(kitInfo)}, CURRENT_TIMESTAMP);\n` +
    `INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES ('fieldMode', jsonb_build_object(\n` +
    `  'enabled', true,\n` +
    `  'since', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),\n` +
    `  'lastExportAt', NULL,\n` +
    `  'enabledBy', 'Kit terrain'\n` +
    `), CURRENT_TIMESTAMP);\n\n` +
    `COMMIT;\n`;

  return {
    sql,
    exportedAt,
    counts: { companies: companies.length, employees: employees.length, users: users.length },
  };
}
