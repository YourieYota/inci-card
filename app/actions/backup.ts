'use server';

import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import bcrypt from 'bcrypt';

export async function verifyAdminAndPassword(passwordConfirm?: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    throw new Error('Non autorisé. Session utilisateur invalide.');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error('Utilisateur introuvable dans le système.');
  }

  const roleUpper = (user.role || '').toUpperCase();
  if (roleUpper !== 'ADMIN') {
    throw new Error('Accès refusé : Seuls les comptes possédant le rôle Administrateur sont autorisés à effectuer des sauvegardes ou restaurations.');
  }

  if (!passwordConfirm || !passwordConfirm.trim()) {
    throw new Error('Le mot de passe de votre compte est obligatoire pour valider cette opération.');
  }

  const isValidPassword = await bcrypt.compare(passwordConfirm, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Mot de passe incorrect. Opération refusée.');
  }

  return user;
}

import os from 'os';

export interface AutoBackupConfig {
  enabled: boolean;
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  maxBackups: number;
  rotationStrategy: 'delete_oldest' | 'overwrite_latest' | 'keep_all';
  format: 'json' | 'sql' | 'both';
  lastBackupAt?: string | null;
}

const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: false,
  interval: 'daily',
  maxBackups: 7,
  rotationStrategy: 'delete_oldest',
  format: 'both',
  lastBackupAt: null,
};

const isWindows = process.platform === 'win32';
const EXTERNAL_BASE_DIR = process.env.EXTERNAL_BACKUP_DIR || (isWindows ? 'C:\\inci-card' : '/home/inci-card');
const DRIVE_C_DIR = EXTERNAL_BASE_DIR;
const DRIVE_C_BACKUP_DIR = path.join(EXTERNAL_BASE_DIR, 'backups');

function getPrimaryBackupDir(): string {
  const fallback = path.join(os.tmpdir(), 'inci-card-backups');
  const preferred = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    // Verify write permissions
    const testFile = path.join(preferred, `.perm_test_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return preferred;
  } catch (err) {
    console.warn(`Preferred backup directory (${preferred}) is not writable, falling back to temp dir:`, err);
    try {
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
      return fallback;
    } catch (fallbackErr) {
      console.error('Fallback backup directory creation failed:', fallbackErr);
      return fallback;
    }
  }
}

let cachedBackupDir: string | null = null;

function ensureBackupDir(): string {
  const backupDir = getPrimaryBackupDir();
  cachedBackupDir = backupDir;

  try {
    if (!fs.existsSync(DRIVE_C_DIR)) {
      fs.mkdirSync(DRIVE_C_DIR, { recursive: true });
    }
    if (!fs.existsSync(DRIVE_C_BACKUP_DIR)) {
      fs.mkdirSync(DRIVE_C_BACKUP_DIR, { recursive: true });
    }
  } catch (e) {
    // Secondary location failure can be safely ignored
  }

  return backupDir;
}

function getConfigFile(): string {
  const dir = cachedBackupDir || ensureBackupDir();
  return path.join(dir, 'backup_config.json');
}

export async function getDatabaseStats() {
  try {
    const [companiesCount, employeesCount, templatesCount, batchesCount, usersCount] = await Promise.all([
      prisma.company.count(),
      prisma.employee.count(),
      prisma.cardTemplate.count(),
      prisma.deliveryBatch.count(),
      prisma.user.count(),
    ]);

    return {
      success: true,
      stats: {
        companies: companiesCount,
        employees: employeesCount,
        templates: templatesCount,
        deliveryBatches: batchesCount,
        users: usersCount,
      },
    };
  } catch (error: any) {
    console.error('Error fetching database stats:', error);
    return { success: false, error: error.message };
  }
}

export async function exportDatabaseBackup(passwordConfirm?: string, isSystemAutoBackup: boolean = false) {
  try {
    if (!isSystemAutoBackup) {
      await verifyAdminAndPassword(passwordConfirm);
    }

    const [
      companies,
      employees,
      cardTemplates,
      cardCategories,
      cardFormats,
      cardPhysicalTypes,
      cardDocumentTypes,
      deliveryBatches,
      customRoles,
      users,
      printJobs
    ] = await Promise.all([
      prisma.company.findMany(),
      prisma.employee.findMany(),
      prisma.cardTemplate.findMany(),
      prisma.cardCategory.findMany(),
      prisma.cardFormat.findMany(),
      prisma.cardPhysicalType.findMany(),
      prisma.cardDocumentType.findMany(),
      prisma.deliveryBatch.findMany(),
      prisma.customRole.findMany(),
      prisma.user.findMany(),
      prisma.printJob.findMany(),
    ]);

    const backupData = {
      meta: {
        appName: 'INCI CARD',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        counts: {
          companies: companies.length,
          employees: employees.length,
          cardTemplates: cardTemplates.length,
          deliveryBatches: deliveryBatches.length,
          users: users.length,
          printJobs: printJobs.length,
        }
      },
      data: {
        companies,
        employees,
        cardTemplates,
        cardCategories,
        cardFormats,
        cardPhysicalTypes,
        cardDocumentTypes,
        deliveryBatches,
        customRoles,
        users,
        printJobs,
      }
    };

    const primaryDir = ensureBackupDir();
    const formattedDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `inci-card-backup-${formattedDate}.json`;
    const jsonString = JSON.stringify(backupData, null, 2);

    if (!isSystemAutoBackup) {
      try {
        const filePath = path.join(primaryDir, filename);
        fs.writeFileSync(filePath, jsonString, 'utf-8');
      } catch (writeErr) {
        console.warn('Could not save JSON backup file to primary dir:', writeErr);
      }

      try {
        if (fs.existsSync(DRIVE_C_BACKUP_DIR)) {
          fs.writeFileSync(path.join(DRIVE_C_BACKUP_DIR, filename), jsonString, 'utf-8');
        }
      } catch (e) {
        console.warn('Error writing JSON backup copy to C drive backups folder:', e);
      }
    }

    return {
      success: true,
      jsonString,
      filename,
    };
  } catch (error: any) {
    console.error('Error exporting database backup:', error);
    return { success: false, error: error.message || 'Impossible d\'exporter la base de données' };
  }
}

export async function restoreFromSavedServerFile(filename: string, passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);
    const primaryDir = ensureBackupDir();
    const safeFilename = path.basename(filename);

    let filePath = path.join(primaryDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DRIVE_C_DIR, safeFilename);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DRIVE_C_BACKUP_DIR, safeFilename);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable : ${filename}`);
    }

    const dataStr = fs.readFileSync(filePath, 'utf-8');
    if (safeFilename.endsWith('.sql')) {
      return await restoreDatabaseFromSql(dataStr, passwordConfirm);
    } else {
      let parsedJson;
      try {
        parsedJson = JSON.parse(dataStr);
      } catch (e: any) {
        throw new Error(`Fichier JSON corrompu ou tronqué (${e.message})`);
      }
      return await restoreDatabaseBackup(parsedJson, passwordConfirm);
    }
  } catch (error: any) {
    console.error('Error in restoreFromSavedServerFile:', error);
    return { success: false, error: error.message || 'Erreur lors de la restauration du fichier serveur' };
  }
}

export async function uploadAndRestoreBackup(formData: FormData) {
  try {
    const passwordConfirm = formData.get('passwordConfirm') as string;
    await verifyAdminAndPassword(passwordConfirm);

    const file = formData.get('file') as File | null;
    if (!file) {
      throw new Error('Aucun fichier de sauvegarde fourni.');
    }

    const textContent = await file.text();
    if (!textContent || !textContent.trim()) {
      throw new Error('Fichier de sauvegarde vide.');
    }

    if (file.name.endsWith('.sql')) {
      return await restoreDatabaseFromSql(textContent, passwordConfirm);
    } else {
      let parsedJson;
      try {
        parsedJson = JSON.parse(textContent);
      } catch (err: any) {
        throw new Error(`Fichier JSON invalide ou tronqué : ${err.message}`);
      }
      return await restoreDatabaseBackup(parsedJson, passwordConfirm);
    }
  } catch (error: any) {
    console.error('Error in uploadAndRestoreBackup:', error);
    return { success: false, error: error.message || 'Échec de la restauration du fichier' };
  }
}

export async function exportDatabaseSql(passwordConfirm?: string, isSystemAutoBackup: boolean = false) {
  try {
    if (!isSystemAutoBackup) {
      await verifyAdminAndPassword(passwordConfirm);
    }
    ensureBackupDir();

    const [
      customRoles,
      users,
      companies,
      cardFormats,
      cardPhysicalTypes,
      cardDocumentTypes,
      cardCategories,
      cardTemplates,
      deliveryBatches,
      employees,
      printJobs,
    ] = await Promise.all([
      prisma.customRole.findMany(),
      prisma.user.findMany(),
      prisma.company.findMany(),
      prisma.cardFormat.findMany(),
      prisma.cardPhysicalType.findMany(),
      prisma.cardDocumentType.findMany(),
      prisma.cardCategory.findMany(),
      prisma.cardTemplate.findMany(),
      prisma.deliveryBatch.findMany(),
      prisma.employee.findMany(),
      prisma.printJob.findMany(),
    ]);

    const toSqlValue = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (typeof val === 'number') return String(val);
      if (val instanceof Date) return `'${val.toISOString()}'`;
      if (typeof val === 'object') {
        const jsonStr = JSON.stringify(val).replace(/'/g, "''");
        return `'${jsonStr}'`;
      }
      const str = String(val).replace(/'/g, "''");
      return `'${str}'`;
    };

    const generateTableInserts = (tableName: string, rows: any[]): string => {
      if (!rows || rows.length === 0) return `-- No records for table "${tableName}"\n\n`;
      const lines: string[] = [`-- ============================================================`, `-- Table: "${tableName}" (${rows.length} rows)`, `-- ============================================================`];
      
      const colSet = new Set<string>();
      rows.forEach(r => Object.keys(r).forEach(k => colSet.add(k)));
      const cols = Array.from(colSet);
      const colList = cols.map(c => `"${c}"`).join(', ');

      rows.forEach(row => {
        const values = cols.map(c => toSqlValue(row[c])).join(', ');
        lines.push(`INSERT INTO "${tableName}" (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;`);
      });

      return lines.join('\n') + '\n\n';
    };

    const nowIso = new Date().toISOString();
    const sqlHeader = `-- ============================================================\n` +
      `-- INCI CARD DATABASE SQL BACKUP DUMP\n` +
      `-- Generated at: ${nowIso}\n` +
      `-- ============================================================\n\n` +
      `BEGIN;\n\n`;

    const sqlFooter = `COMMIT;\n`;

    const sqlContent = sqlHeader +
      generateTableInserts('CustomRole', customRoles) +
      generateTableInserts('User', users) +
      generateTableInserts('Company', companies) +
      generateTableInserts('CardFormat', cardFormats) +
      generateTableInserts('CardPhysicalType', cardPhysicalTypes) +
      generateTableInserts('CardDocumentType', cardDocumentTypes) +
      generateTableInserts('CardCategory', cardCategories) +
      generateTableInserts('CardTemplate', cardTemplates) +
      generateTableInserts('DeliveryBatch', deliveryBatches) +
      generateTableInserts('Employee', employees) +
      generateTableInserts('PrintJob', printJobs) +
      sqlFooter;

    const primaryDir = ensureBackupDir();

    const formattedDate = nowIso.replace(/[:.]/g, '-').slice(0, 19);
    const filename = `inci-card-dump-${formattedDate}.sql`;

    try {
      const filePath = path.join(primaryDir, filename);
      fs.writeFileSync(filePath, sqlContent, 'utf-8');
    } catch (writeErr) {
      console.warn('Could not save SQL dump file to primary dir:', writeErr);
    }

    try {
      if (fs.existsSync(DRIVE_C_DIR)) {
        fs.writeFileSync(path.join(DRIVE_C_DIR, filename), sqlContent, 'utf-8');
      }
    } catch (driveErr) {
      console.warn('Error writing SQL dump copy to C drive:', driveErr);
    }

    return {
      success: true,
      sqlString: sqlContent,
      filename,
    };
  } catch (error: any) {
    console.error('Error exporting database SQL:', error);
    return { success: false, error: error.message || 'Impossible d\'exporter le fichier SQL' };
  }
}

export async function restoreDatabaseBackup(backupJsonData: any, passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);

    if (!backupJsonData || !backupJsonData.data) {
      throw new Error('Fichier de sauvegarde invalide ou corrompu');
    }

    const { data } = backupJsonData;

    await prisma.$transaction(async (tx) => {
      // Clear data tables in reverse dependency order to restore exact database snapshot
      await tx.$executeRawUnsafe(`
        DELETE FROM "PrintJob";
        DELETE FROM "Employee";
        DELETE FROM "DeliveryBatch";
        DELETE FROM "CardTemplate";
        DELETE FROM "CardCategory";
        DELETE FROM "CardDocumentType";
        DELETE FROM "CardPhysicalType";
        DELETE FROM "CardFormat";
        DELETE FROM "Company";
      `);

      // 1. CustomRole
      if (Array.isArray(data.customRoles)) {
        for (const r of data.customRoles) {
          await tx.customRole.upsert({
            where: { id: r.id },
            update: { name: r.name, slug: r.slug, description: r.description, color: r.color, permissions: r.permissions ?? {} },
            create: { id: r.id, name: r.name, slug: r.slug, description: r.description, color: r.color, isSystem: r.isSystem ?? false, permissions: r.permissions ?? {} }
          });
        }
      }

      // 2. CardFormat
      if (Array.isArray(data.cardFormats)) {
        for (const f of data.cardFormats) {
          await tx.cardFormat.upsert({
            where: { id: f.id },
            update: { name: f.name, width: f.width, height: f.height, unit: f.unit },
            create: { id: f.id, name: f.name, width: f.width, height: f.height, unit: f.unit }
          });
        }
      }

      // 3. CardPhysicalType
      if (Array.isArray(data.cardPhysicalTypes)) {
        for (const p of data.cardPhysicalTypes) {
          await tx.cardPhysicalType.upsert({
            where: { id: p.id },
            update: { name: p.name, description: p.description },
            create: { id: p.id, name: p.name, slug: p.slug, description: p.description }
          });
        }
      }

      // 4. CardDocumentType
      if (Array.isArray(data.cardDocumentTypes)) {
        for (const d of data.cardDocumentTypes) {
          await tx.cardDocumentType.upsert({
            where: { id: d.id },
            update: { name: d.name, description: d.description },
            create: { id: d.id, name: d.name, slug: d.slug, description: d.description }
          });
        }
      }

      // 5. CardCategory
      if (Array.isArray(data.cardCategories)) {
        for (const c of data.cardCategories) {
          await tx.cardCategory.upsert({
            where: { id: c.id },
            update: { name: c.name, description: c.description },
            create: { id: c.id, name: c.name, slug: c.slug, formatId: c.formatId, description: c.description }
          });
        }
      }

      // 6. Companies
      if (Array.isArray(data.companies)) {
        for (const company of data.companies) {
          await tx.company.upsert({
            where: { id: company.id },
            update: {
              name: company.name,
              identifierPrefix: company.identifierPrefix,
              isLocked: company.isLocked ?? false,
              isLaserEnabled: company.isLaserEnabled ?? false,
              protectAppModified: company.protectAppModified ?? true,
            },
            create: {
              id: company.id,
              name: company.name,
              identifierPrefix: company.identifierPrefix,
              isLocked: company.isLocked ?? false,
              isLaserEnabled: company.isLaserEnabled ?? false,
              protectAppModified: company.protectAppModified ?? true,
              createdAt: company.createdAt ? new Date(company.createdAt) : undefined,
            },
          });
        }
      }

      // 7. Delivery Batches if any
      if (Array.isArray(data.deliveryBatches)) {
        for (const batch of data.deliveryBatches) {
          await tx.deliveryBatch.upsert({
            where: { id: batch.id },
            update: {
              batchNumber: batch.batchNumber,
              status: batch.status ?? 'PREPARE',
              deliveredAt: batch.deliveredAt ? new Date(batch.deliveredAt) : null,
              shippedAt: batch.shippedAt ? new Date(batch.shippedAt) : null,
              signedProof: batch.signedProof,
              signedProofName: batch.signedProofName,
              signedProofType: batch.signedProofType,
              cardDocumentTypeSlug: batch.cardDocumentTypeSlug,
            },
            create: {
              id: batch.id,
              companyId: batch.companyId,
              batchNumber: batch.batchNumber,
              status: batch.status ?? 'PREPARE',
              deliveredAt: batch.deliveredAt ? new Date(batch.deliveredAt) : null,
              shippedAt: batch.shippedAt ? new Date(batch.shippedAt) : null,
              signedProof: batch.signedProof,
              signedProofName: batch.signedProofName,
              signedProofType: batch.signedProofType,
              cardDocumentTypeSlug: batch.cardDocumentTypeSlug,
              createdAt: batch.createdAt ? new Date(batch.createdAt) : undefined,
            },
          });
        }
      }

      // 8. Employees
      if (Array.isArray(data.employees)) {
        for (const emp of data.employees) {
          await tx.employee.upsert({
            where: { id: emp.id },
            update: {
              companyId: emp.companyId,
              dynamicData: emp.dynamicData ?? {},
              uniqueIdentifier: emp.uniqueIdentifier,
              photoUrl: emp.photoUrl,
              status: emp.status ?? 'A_ENROLER',
              enrollmentNumber: emp.enrollmentNumber,
              printedAt: emp.printedAt ? new Date(emp.printedAt) : null,
              photoConflict: emp.photoConflict ?? false,
              photoHash: emp.photoHash,
              deliveryBatchId: emp.deliveryBatchId,
              cardNumber: emp.cardNumber,
              isBlocked: emp.isBlocked ?? false,
              isLocked: emp.isLocked ?? false,
              printCount: emp.printCount ?? 0,
              appModified: emp.appModified ?? false,
              externalQrUrl: emp.externalQrUrl,
            },
            create: {
              id: emp.id,
              companyId: emp.companyId,
              dynamicData: emp.dynamicData ?? {},
              uniqueIdentifier: emp.uniqueIdentifier,
              photoUrl: emp.photoUrl,
              status: emp.status ?? 'A_ENROLER',
              enrollmentNumber: emp.enrollmentNumber,
              printedAt: emp.printedAt ? new Date(emp.printedAt) : null,
              createdAt: emp.createdAt ? new Date(emp.createdAt) : undefined,
              photoConflict: emp.photoConflict ?? false,
              photoHash: emp.photoHash,
              deliveryBatchId: emp.deliveryBatchId,
              cardNumber: emp.cardNumber,
              isBlocked: emp.isBlocked ?? false,
              isLocked: emp.isLocked ?? false,
              printCount: emp.printCount ?? 0,
              appModified: emp.appModified ?? false,
              externalQrUrl: emp.externalQrUrl,
            },
          });
        }
      }

      // 9. Templates
      if (Array.isArray(data.cardTemplates)) {
        for (const template of data.cardTemplates) {
          await tx.cardTemplate.upsert({
            where: { id: template.id },
            update: {
              companyId: template.companyId,
              width: template.width,
              height: template.height,
              backgroundUrl: template.backgroundUrl,
              layoutConfig: template.layoutConfig,
              type: template.type ?? 'BADGE',
              categoryId: template.categoryId,
            },
            create: {
              id: template.id,
              companyId: template.companyId,
              width: template.width,
              height: template.height,
              backgroundUrl: template.backgroundUrl,
              layoutConfig: template.layoutConfig,
              type: template.type ?? 'BADGE',
              categoryId: template.categoryId,
            },
          });
        }
      }

      // 10. Users
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          const updateData: any = {
            email: u.email,
            name: u.name,
            firstName: u.firstName,
            login: u.login,
            phone: u.phone,
            role: u.role,
          };
          if (u.passwordHash) updateData.passwordHash = u.passwordHash;

          await tx.user.upsert({
            where: { id: u.id },
            update: updateData,
            create: {
              id: u.id,
              email: u.email,
              passwordHash: u.passwordHash || '',
              name: u.name,
              firstName: u.firstName,
              login: u.login,
              phone: u.phone,
              role: u.role ?? 'OPERATEUR',
              createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
            },
          });
        }
      }

      // 11. PrintJobs
      if (Array.isArray(data.printJobs)) {
        for (const pj of data.printJobs) {
          await tx.printJob.upsert({
            where: { id: pj.id },
            update: {
              employeeId: pj.employeeId,
              cardNumber: pj.cardNumber,
              templateType: pj.templateType,
              categoryId: pj.categoryId,
              physicalTypeId: pj.physicalTypeId,
              isReprint: pj.isReprint ?? false,
              reprintReason: pj.reprintReason,
              printedBy: pj.printedBy,
              printedAt: pj.printedAt ? new Date(pj.printedAt) : undefined,
            },
            create: {
              id: pj.id,
              employeeId: pj.employeeId,
              cardNumber: pj.cardNumber,
              templateType: pj.templateType,
              categoryId: pj.categoryId,
              physicalTypeId: pj.physicalTypeId,
              isReprint: pj.isReprint ?? false,
              reprintReason: pj.reprintReason,
              printedBy: pj.printedBy,
              printedAt: pj.printedAt ? new Date(pj.printedAt) : undefined,
              createdAt: pj.createdAt ? new Date(pj.createdAt) : undefined,
            },
          });
        }
      }
    }, { maxWait: 60000, timeout: 600000 });

    return { success: true, message: 'Sauvegarde restaurée avec succès !' };
  } catch (error: any) {
    console.error('Error restoring database backup:', error);
    return { success: false, error: error.message || 'Échec de la restauration de la base de données' };
  }
}

// ─── Automated Backup Server Actions ─────────────────────────────────────────

export async function getAutoBackupConfig(): Promise<AutoBackupConfig> {
  try {
    ensureBackupDir();
    const configFile = getConfigFile();
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Error reading auto backup config:', e);
  }
  return DEFAULT_CONFIG;
}

export async function saveAutoBackupConfig(newConfig: Partial<AutoBackupConfig>, passwordConfirm?: string) {
  try {
    if (passwordConfirm !== undefined) {
      await verifyAdminAndPassword(passwordConfirm);
    }
    ensureBackupDir();
    const configFile = getConfigFile();
    const current = await getAutoBackupConfig();
    const updated = { ...current, ...newConfig };
    fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), 'utf-8');
    return { success: true, config: updated };
  } catch (e: any) {
    console.error('Error saving auto backup config:', e);
    return { success: false, error: e.message || 'Impossible de sauvegarder la configuration' };
  }
}

export async function listLocalServerBackups() {
  try {
    const backupDir = ensureBackupDir();
    const map = new Map<string, { filename: string; sizeBytes: number; createdAt: string; modifiedAt: string; path: string }>();

    const dirsToScan = [
      { dir: backupDir, filter: (f: string) => f.endsWith('.json') || f.endsWith('.sql') },
      { dir: DRIVE_C_DIR, filter: (f: string) => f.endsWith('.sql') },
      { dir: DRIVE_C_BACKUP_DIR, filter: (f: string) => f.endsWith('.json') },
    ];

    for (const { dir, filter } of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const filename of files) {
        if (filename === 'backup_config.json' || !filter(filename)) continue;
        const filePath = path.join(dir, filename);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile() && !map.has(filename)) {
            map.set(filename, {
              filename,
              sizeBytes: stats.size,
              createdAt: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString(),
              path: filePath,
            });
          }
        } catch (e) {}
      }
    }

    const backupFiles = Array.from(map.values()).sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );

    return { success: true, files: backupFiles };
  } catch (e: any) {
    console.error('Error listing server backups:', e);
    return { success: false, error: e.message || 'Erreur lors de la lecture des fichiers' };
  }
}

export async function deleteLocalServerBackup(filename: string, passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);
    const backupDir = ensureBackupDir();
    const safeFilename = path.basename(filename);
    const filePath = path.join(backupDir, safeFilename);
    if (fs.existsSync(filePath) && safeFilename !== 'backup_config.json') {
      fs.unlinkSync(filePath);
      try {
        const c1 = path.join(DRIVE_C_DIR, safeFilename);
        if (fs.existsSync(c1)) fs.unlinkSync(c1);
        const c2 = path.join(DRIVE_C_BACKUP_DIR, safeFilename);
        if (fs.existsSync(c2)) fs.unlinkSync(c2);
      } catch (e) {}
      return { success: true };
    }
    return { success: false, error: 'Fichier introuvable' };
  } catch (e: any) {
    console.error('Error deleting server backup:', e);
    return { success: false, error: e.message || 'Erreur lors de la suppression' };
  }
}

function parseSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      current += char;
      if (char === "'") {
        if (nextChar === "'") {
          current += nextChar;
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }

    if (char === ';') {
      const stmt = current.trim();
      if (stmt) {
        statements.push(stmt);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const remaining = current.trim();
  if (remaining) {
    statements.push(remaining);
  }

  return statements;
}

export async function restoreDatabaseFromSql(sqlContent: string, passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);

    if (!sqlContent || !sqlContent.trim()) {
      throw new Error('Fichier SQL vide ou invalide');
    }

    const rawStatements = parseSqlStatements(sqlContent);
    const statements = rawStatements.filter(s => {
      if (!s) return false;
      const upper = s.toUpperCase().trim();
      return (
        upper !== 'BEGIN' &&
        upper !== 'COMMIT' &&
        !upper.startsWith('SET SESSION_REPLICATION_ROLE')
      );
    });

    await prisma.$transaction(async (tx) => {
      // Clear data tables in reverse dependency order to restore exact database snapshot
      await tx.$executeRawUnsafe(`
        DELETE FROM "PrintJob";
        DELETE FROM "Employee";
        DELETE FROM "DeliveryBatch";
        DELETE FROM "CardTemplate";
        DELETE FROM "CardCategory";
        DELETE FROM "CardDocumentType";
        DELETE FROM "CardPhysicalType";
        DELETE FROM "CardFormat";
        DELETE FROM "Company";
      `);

      for (const statement of statements) {
        let cleaned = statement.trim();
        if (cleaned.length > 0) {
          if (/^INSERT\s+INTO/i.test(cleaned) && !/ON\s+CONFLICT/i.test(cleaned)) {
            cleaned += ' ON CONFLICT DO NOTHING';
          }
          await tx.$executeRawUnsafe(cleaned);
        }
      }
    }, { maxWait: 60000, timeout: 600000 });

    return { success: true, message: 'Base de données restaurée avec succès depuis le fichier SQL !' };
  } catch (error: any) {
    console.error('Error restoring database from SQL:', error);
    return { success: false, error: error.message || 'Échec de la restauration depuis le fichier SQL' };
  }
}

export async function readLocalServerBackup(filename: string) {
  try {
    const backupDir = ensureBackupDir();
    const safeFilename = path.basename(filename);
    let filePath = path.join(backupDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DRIVE_C_DIR, safeFilename);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DRIVE_C_BACKUP_DIR, safeFilename);
    }
    if (fs.existsSync(filePath)) {
      const dataStr = fs.readFileSync(filePath, 'utf-8');
      if (safeFilename.endsWith('.sql')) {
        return { success: true, isSql: true, sqlString: dataStr, jsonString: dataStr };
      }
      return { success: true, isSql: false, data: JSON.parse(dataStr), jsonString: dataStr };
    }
    return { success: false, error: 'Fichier introuvable' };
  } catch (e: any) {
    console.error('Error reading server backup:', e);
    return { success: false, error: e.message || 'Erreur lors de la lecture du fichier' };
  }
}

export async function executeAutoBackupNow(passwordConfirm?: string, isManualTrigger: boolean = false) {
  try {
    if (isManualTrigger) {
      await verifyAdminAndPassword(passwordConfirm);
    }
    const backupDir = ensureBackupDir();
    const config = await getAutoBackupConfig();
    const targetFormat = config.format || 'both';

    let lastCreatedFilename = '';

    // 1. JSON Auto Backup
    if (targetFormat === 'json' || targetFormat === 'both') {
      const exportRes = await exportDatabaseBackup(passwordConfirm, true);
      if (exportRes.success && exportRes.jsonString) {
        const now = new Date();
        const filename = config.rotationStrategy === 'overwrite_latest'
          ? 'inci-card-autobackup-latest.json'
          : `inci-card-autobackup-${now.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;

        fs.writeFileSync(path.join(backupDir, filename), exportRes.jsonString, 'utf-8');
        try {
          if (fs.existsSync(DRIVE_C_BACKUP_DIR)) {
            fs.writeFileSync(path.join(DRIVE_C_BACKUP_DIR, filename), exportRes.jsonString, 'utf-8');
          }
        } catch (e) {}

        lastCreatedFilename = filename;
      }
    }

    // 2. SQL Auto Backup
    if (targetFormat === 'sql' || targetFormat === 'both') {
      const sqlRes = await exportDatabaseSql(passwordConfirm, true);
      if (sqlRes.success && sqlRes.filename) {
        lastCreatedFilename = sqlRes.filename;
      }
    }

    // Update last backup timestamp
    await saveAutoBackupConfig({ lastBackupAt: new Date().toISOString() });

    // Apply Retention policy if delete_oldest strategy
    if (config.rotationStrategy === 'delete_oldest' && config.maxBackups > 0) {
      const allFilesRes = await listLocalServerBackups();
      if (allFilesRes.success && allFilesRes.files) {
        const files = allFilesRes.files;
        if (files.length > config.maxBackups) {
          const oldestFirst = [...files].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          const excessCount = files.length - config.maxBackups;
          for (let i = 0; i < excessCount; i++) {
            const fileToDelete = oldestFirst[i];
            if (fileToDelete) {
              const deletePath = path.join(backupDir, fileToDelete.filename);
              if (fs.existsSync(deletePath)) fs.unlinkSync(deletePath);

              try {
                const c1 = path.join(DRIVE_C_DIR, fileToDelete.filename);
                if (fs.existsSync(c1)) fs.unlinkSync(c1);
                const c2 = path.join(DRIVE_C_BACKUP_DIR, fileToDelete.filename);
                if (fs.existsSync(c2)) fs.unlinkSync(c2);
              } catch (e) {}
            }
          }
        }
      }
    }

    return { success: true, filename: lastCreatedFilename || 'sauvegarde-automatique' };
  } catch (e: any) {
    console.error('Error executing auto backup:', e);
    return { success: false, error: e.message || 'Erreur lors de l\'exécution de la sauvegarde automatique' };
  }
}

export async function checkAndRunAutoBackupIfNeeded() {
  try {
    const config = await getAutoBackupConfig();
    if (!config.enabled) return { success: true, executed: false, reason: 'Disabled' };

    const last = config.lastBackupAt ? new Date(config.lastBackupAt).getTime() : 0;
    const now = Date.now();
    const diffHours = (now - last) / (1000 * 60 * 60);

    let thresholdHours = 24; // default daily
    if (config.interval === 'hourly') thresholdHours = 1;
    else if (config.interval === 'daily') thresholdHours = 24;
    else if (config.interval === 'weekly') thresholdHours = 24 * 7;
    else if (config.interval === 'monthly') thresholdHours = 24 * 30;

    if (diffHours >= thresholdHours) {
      const res = await executeAutoBackupNow();
      return { success: true, executed: true, result: res };
    }

    return { success: true, executed: false, reason: 'Interval not reached yet' };
  } catch (e: any) {
    console.error('Error checking auto backup:', e);
    return { success: false, error: e.message };
  }
}
