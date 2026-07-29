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

export interface AutoBackupConfig {
  enabled: boolean;
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  maxBackups: number;
  rotationStrategy: 'delete_oldest' | 'overwrite_latest' | 'keep_all';
  format: 'json' | 'sql' | 'both';
  lastBackupAt?: string | null;
}

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DRIVE_C_DIR = 'C:\\inci-card';
const DRIVE_C_BACKUP_DIR = 'C:\\inci-card\\backups';
const CONFIG_FILE = path.join(BACKUP_DIR, 'backup_config.json');

const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: false,
  interval: 'daily',
  maxBackups: 7,
  rotationStrategy: 'delete_oldest',
  format: 'both',
  lastBackupAt: null,
};

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  try {
    if (!fs.existsSync(DRIVE_C_DIR)) {
      fs.mkdirSync(DRIVE_C_DIR, { recursive: true });
    }
    if (!fs.existsSync(DRIVE_C_BACKUP_DIR)) {
      fs.mkdirSync(DRIVE_C_BACKUP_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn('Could not create directory on C drive:', e);
  }
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

export async function exportDatabaseBackup(passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);

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
      users
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
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          login: true,
          phone: true,
          role: true,
          createdAt: true,
        }
      }),
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
      }
    };

    return {
      success: true,
      jsonString: JSON.stringify(backupData),
      filename: `inci-card-backup-${new Date().toISOString().slice(0, 10)}.json`,
    };
  } catch (error: any) {
    console.error('Error exporting database backup:', error);
    return { success: false, error: error.message || 'Impossible d\'exporter la base de données' };
  }
}

export async function restoreFromSavedServerFile(filename: string, passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);
    ensureBackupDir();
    const safeFilename = path.basename(filename);

    let filePath = path.join(BACKUP_DIR, safeFilename);
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

export async function exportDatabaseSql(passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);
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
        lines.push(`INSERT INTO "${tableName}" (${colList}) VALUES (${values});`);
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

    const formattedDate = nowIso.replace(/[:.]/g, '-').slice(0, 19);
    const filename = `inci-card-dump-${formattedDate}.sql`;

    const filePath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filePath, sqlContent, 'utf-8');

    try {
      if (fs.existsSync(DRIVE_C_DIR)) {
        fs.writeFileSync(path.join(DRIVE_C_DIR, filename), sqlContent, 'utf-8');
      }
      if (fs.existsSync(DRIVE_C_BACKUP_DIR)) {
        fs.writeFileSync(path.join(DRIVE_C_BACKUP_DIR, filename), sqlContent, 'utf-8');
      }
    } catch (driveErr) {
      console.warn('Error writing SQL copy to C drive:', driveErr);
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
    });

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
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
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
    const current = await getAutoBackupConfig();
    const updated = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return { success: true, config: updated };
  } catch (e: any) {
    console.error('Error saving auto backup config:', e);
    return { success: false, error: e.message || 'Impossible de sauvegarder la configuration' };
  }
}

export async function listLocalServerBackups() {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter((f) => (f.endsWith('.json') || f.endsWith('.sql')) && f !== 'backup_config.json')
      .map((filename) => {
        const filePath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return { success: true, files: backupFiles };
  } catch (e: any) {
    console.error('Error listing server backups:', e);
    return { success: false, error: e.message || 'Erreur lors de la lecture des fichiers' };
  }
}

export async function deleteLocalServerBackup(filename: string, passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);
    ensureBackupDir();
    const safeFilename = path.basename(filename);
    const filePath = path.join(BACKUP_DIR, safeFilename);
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

export async function restoreDatabaseFromSql(sqlContent: string, passwordConfirm?: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);

    if (!sqlContent || !sqlContent.trim()) {
      throw new Error('Fichier SQL vide ou invalide');
    }

    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        if (!s) return false;
        const upper = s.toUpperCase();
        return !upper.startsWith('--') && upper !== 'BEGIN' && upper !== 'COMMIT';
      });

    await prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRawUnsafe("SET session_replication_role = 'replica';");
      } catch (e) {}

      for (const statement of statements) {
        const cleaned = statement
          .split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
        if (cleaned.length > 0) {
          await tx.$executeRawUnsafe(cleaned);
        }
      }

      try {
        await tx.$executeRawUnsafe("SET session_replication_role = 'origin';");
      } catch (e) {}
    });

    return { success: true, message: 'Base de données restaurée avec succès depuis le fichier SQL !' };
  } catch (error: any) {
    console.error('Error restoring database from SQL:', error);
    return { success: false, error: error.message || 'Échec de la restauration depuis le fichier SQL' };
  }
}

export async function readLocalServerBackup(filename: string) {
  try {
    ensureBackupDir();
    const safeFilename = path.basename(filename);
    let filePath = path.join(BACKUP_DIR, safeFilename);
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
    ensureBackupDir();
    const config = await getAutoBackupConfig();
    const targetFormat = config.format || 'both';

    let lastCreatedFilename = '';

    // 1. JSON Auto Backup
    if (targetFormat === 'json' || targetFormat === 'both') {
      const exportRes = await exportDatabaseBackup();
      if (exportRes.success && exportRes.jsonString) {
        const now = new Date();
        const filename = config.rotationStrategy === 'overwrite_latest'
          ? 'inci-card-autobackup-latest.json'
          : `inci-card-autobackup-${now.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;

        fs.writeFileSync(path.join(BACKUP_DIR, filename), exportRes.jsonString, 'utf-8');
        try {
          if (fs.existsSync(DRIVE_C_DIR)) fs.writeFileSync(path.join(DRIVE_C_DIR, filename), exportRes.jsonString, 'utf-8');
          if (fs.existsSync(DRIVE_C_BACKUP_DIR)) fs.writeFileSync(path.join(DRIVE_C_BACKUP_DIR, filename), exportRes.jsonString, 'utf-8');
        } catch (e) {}

        lastCreatedFilename = filename;
      }
    }

    // 2. SQL Auto Backup
    if (targetFormat === 'sql' || targetFormat === 'both') {
      const sqlRes = await exportDatabaseSql();
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
              const deletePath = path.join(BACKUP_DIR, fileToDelete.filename);
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
