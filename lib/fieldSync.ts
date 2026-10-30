import crypto from 'crypto';
import JSZip from 'jszip';
import { Prisma, Employee, Company } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getFieldModeState, saveFieldModeState, ensureAppSettingTable } from '@/lib/fieldMode';
import { nextEnrollmentNumber } from '@/lib/enrollmentNumber';
import { generateTableInserts } from '@/lib/sqlDump';

// Synchronisation terrain → serveur principal.
// Le PC terrain exporte un .zip (manifest.json, data.json, data.sql, photos/) ;
// le serveur l'analyse puis l'applique en ajout uniquement : une fiche modifiée
// des deux côtés n'est jamais écrasée, elle est signalée en conflit.

export const FIELD_SYNC_FORMAT = 'INCI_CARD_FIELD_SYNC';

type Db = Prisma.TransactionClient | typeof prisma;

interface FieldKitInfo {
  kitId: string;
  exportedAt: string;
}

export interface FieldSyncManifest {
  format: string;
  version: number;
  kitId: string | null;
  kitExportedAt: string | null;
  exportedAt: string;
  exportedBy: string;
  counts: { companies: number; employees: number; photos: number };
  dataSha256: string;
}

export interface FieldSyncPackage {
  manifest: FieldSyncManifest;
  companies: Company[];
  employees: Employee[];
}

export type FieldSyncAction = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT';

export interface FieldSyncItem {
  id: string;
  uniqueIdentifier: string;
  displayName: string;
  companyName: string;
  action: FieldSyncAction;
  reason?: string;
  assignNumber: boolean;
  photoDuplicate: boolean;
}

export interface FieldSyncPlan {
  manifest: FieldSyncManifest;
  companiesToCreate: string[];
  items: FieldSyncItem[];
  summary: Record<FieldSyncAction, number>;
  alreadySyncedAt: string | null;
}

const SYNC_LOG_KEY = 'fieldSyncs';

// ─── Export (PC terrain) ─────────────────────────────────────────────────────

const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

const safeFilePart = (value: string) => value.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60);

export async function buildFieldSyncPackage(exportedBy: string) {
  const state = await getFieldModeState();
  if (!state.enabled || !state.since) {
    throw new Error("Cette installation n'est pas en mode terrain : rien à exporter.");
  }

  const kitRow = await prisma.appSetting.findUnique({ where: { key: 'fieldKit' } });
  const kit = (kitRow?.value as unknown as FieldKitInfo | undefined) ?? null;

  // Toutes les fiches créées ou modifiées depuis l'activation : un export est toujours complet
  const employees = await prisma.employee.findMany({
    where: { updatedAt: { gt: new Date(state.since) } },
    orderBy: { updatedAt: 'asc' },
  });
  const companies = await prisma.company.findMany({
    where: { id: { in: [...new Set(employees.map(e => e.companyId))] } },
  });

  const exportedAt = new Date().toISOString();
  const dataJson = JSON.stringify({ companies, employees });

  const zip = new JSZip();
  let photoCount = 0;
  for (const emp of employees) {
    const match = emp.photoUrl?.match(/^data:image\/([a-z+]+);base64,(.+)$/i);
    if (!match) continue;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    zip.file(`photos/${safeFilePart(emp.uniqueIdentifier)}_${emp.id.slice(0, 8)}.${ext}`, match[2], { base64: true });
    photoCount++;
  }

  const manifest: FieldSyncManifest = {
    format: FIELD_SYNC_FORMAT,
    version: 1,
    kitId: kit?.kitId ?? null,
    kitExportedAt: kit?.exportedAt ?? null,
    exportedAt,
    exportedBy,
    counts: { companies: companies.length, employees: employees.length, photos: photoCount },
    dataSha256: sha256(dataJson),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('data.json', dataJson);
  zip.file('data.sql',
    `-- INCI CARD - Données terrain exportées le ${exportedAt} (archive lisible, non utilisée par la synchronisation)\n\n` +
    generateTableInserts('Company', companies) +
    generateTableInserts('Employee', employees)
  );

  const zipBase64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });

  await saveFieldModeState({ ...state, lastExportAt: exportedAt });

  return {
    zipBase64,
    filename: `donnees-terrain-${exportedAt.replace(/[:.]/g, '-').slice(0, 19)}.zip`,
    counts: manifest.counts,
  };
}

// ─── Lecture du paquet (serveur) ─────────────────────────────────────────────

export async function readFieldSyncPackage(buffer: Buffer | ArrayBuffer): Promise<FieldSyncPackage> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("Le fichier n'est pas une archive .zip valide.");
  }

  const manifestFile = zip.file('manifest.json');
  const dataFile = zip.file('data.json');
  if (!manifestFile || !dataFile) {
    throw new Error("Archive incomplète : manifest.json ou data.json manquant. Ce n'est pas un export terrain INCI CARD.");
  }

  const manifest = JSON.parse(await manifestFile.async('string')) as FieldSyncManifest;
  if (manifest.format !== FIELD_SYNC_FORMAT || manifest.version !== 1) {
    throw new Error("Format d'export terrain non reconnu.");
  }

  const dataJson = await dataFile.async('string');
  if (sha256(dataJson) !== manifest.dataSha256) {
    throw new Error("L'empreinte des données ne correspond pas au manifeste : fichier altéré ou incomplet.");
  }

  const data = JSON.parse(dataJson) as { companies: Company[]; employees: Employee[] };
  return { manifest, companies: data.companies ?? [], employees: data.employees ?? [] };
}

// ─── Analyse (serveur) ───────────────────────────────────────────────────────

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
};

const sameContent = (a: Employee, b: Employee) =>
  stableStringify(a.dynamicData) === stableStringify(b.dynamicData) && (a.photoHash ?? null) === (b.photoHash ?? null);

const displayNameOf = (emp: Employee) => {
  const d = (emp.dynamicData ?? {}) as Record<string, unknown>;
  const name = `${d.Nom ?? d.nom ?? d.NOM ?? ''} ${d.Prenom ?? d.prenom ?? d.Prénom ?? d.prénom ?? ''}`.trim();
  return name || emp.uniqueIdentifier;
};

interface PlannedEmployee {
  item: FieldSyncItem;
  field: Employee;
  server: Employee | null;
  companyId: string;
  duplicateOfId: string | null;
}

async function buildPlan(pkg: FieldSyncPackage, db: Db) {
  // Entreprises : même id, sinon même nom, sinon création (entreprise créée sur le terrain)
  const companyIdMap = new Map<string, string>();
  const companyNames = new Map<string, string>();
  const companiesToCreate: Company[] = [];
  for (const c of pkg.companies) {
    const byId = await db.company.findUnique({ where: { id: c.id } });
    const target = byId ?? (await db.company.findUnique({ where: { name: c.name } }));
    if (target) {
      companyIdMap.set(c.id, target.id);
    } else {
      companyIdMap.set(c.id, c.id);
      companiesToCreate.push(c);
    }
    companyNames.set(c.id, c.name);
  }

  const kitExportedAt = pkg.manifest.kitExportedAt ? new Date(pkg.manifest.kitExportedAt) : null;
  const planned: PlannedEmployee[] = [];

  for (const fe of pkg.employees) {
    const companyId = companyIdMap.get(fe.companyId) ?? fe.companyId;
    const base = {
      id: fe.id,
      uniqueIdentifier: fe.uniqueIdentifier,
      displayName: displayNameOf(fe),
      companyName: companyNames.get(fe.companyId) ?? '—',
      assignNumber: false,
      photoDuplicate: false,
    };

    const byId = await db.employee.findUnique({ where: { id: fe.id } });
    const server = byId ?? (await db.employee.findUnique({
      where: { companyId_uniqueIdentifier: { companyId, uniqueIdentifier: fe.uniqueIdentifier } },
    }));

    let action: FieldSyncAction;
    let reason: string | undefined;
    if (server && sameContent(server, fe)) {
      action = 'UNCHANGED';
    } else if (server && !byId) {
      action = 'CONFLICT';
      reason = 'Un employé avec ce matricule existe déjà sur le serveur (fiche différente).';
    } else if (server && server.isLocked) {
      action = 'CONFLICT';
      reason = 'Fiche verrouillée sur le serveur (badge déjà imprimé).';
    } else if (server && (!kitExportedAt || server.updatedAt > kitExportedAt)) {
      action = 'CONFLICT';
      reason = 'Fiche modifiée sur le serveur depuis la préparation du kit.';
    } else {
      action = server ? 'UPDATE' : 'CREATE';
    }

    let duplicateOfId: string | null = null;
    if ((action === 'CREATE' || action === 'UPDATE') && fe.photoHash) {
      const dup = await db.employee.findFirst({
        where: { photoHash: fe.photoHash, id: { not: server?.id ?? fe.id } },
        select: { id: true },
      });
      duplicateOfId = dup?.id ?? null;
    }

    const willBeValidated = fe.status === 'PHOTO_VALIDEE' && !duplicateOfId;
    const hasNumber = !!(server?.enrollmentNumber || fe.enrollmentNumber);
    planned.push({
      item: {
        ...base,
        action,
        reason,
        photoDuplicate: !!duplicateOfId,
        assignNumber: (action === 'CREATE' || action === 'UPDATE') && willBeValidated && !hasNumber,
      },
      field: fe,
      server,
      companyId,
      duplicateOfId,
    });
  }

  return { companiesToCreate, planned };
}

interface SyncLogEntry {
  kitId: string | null;
  exportedAt: string;
  syncedAt: string;
  syncedBy?: string;
  result?: Record<string, number>;
}

async function getSyncLog(db: Db): Promise<SyncLogEntry[]> {
  const row = await db.appSetting.findUnique({ where: { key: SYNC_LOG_KEY } });
  return (row?.value as unknown as SyncLogEntry[]) ?? [];
}

export async function planFieldSync(pkg: FieldSyncPackage): Promise<FieldSyncPlan> {
  const { companiesToCreate, planned } = await buildPlan(pkg, prisma);
  const summary: Record<FieldSyncAction, number> = { CREATE: 0, UPDATE: 0, UNCHANGED: 0, CONFLICT: 0 };
  planned.forEach(p => summary[p.item.action]++);

  let alreadySyncedAt: string | null = null;
  try {
    const log = await getSyncLog(prisma);
    alreadySyncedAt = log.find(l => l.kitId === pkg.manifest.kitId && l.exportedAt === pkg.manifest.exportedAt)?.syncedAt ?? null;
  } catch {
    // Table AppSetting absente : aucune synchronisation antérieure
  }

  return {
    manifest: pkg.manifest,
    companiesToCreate: companiesToCreate.map(c => c.name),
    items: planned.map(p => p.item),
    summary,
    alreadySyncedAt,
  };
}

// ─── Application (serveur) ───────────────────────────────────────────────────

export async function applyFieldSync(pkg: FieldSyncPackage, syncedBy: string) {
  await ensureAppSettingTable();

  return prisma.$transaction(async (tx) => {
    // Le plan est recalculé dans la transaction pour travailler sur l'état réel de la base
    const { companiesToCreate, planned } = await buildPlan(pkg, tx);

    for (const c of companiesToCreate) {
      await tx.company.create({
        data: {
          id: c.id,
          name: c.name,
          identifierPrefix: c.identifierPrefix,
          isLocked: c.isLocked ?? false,
          isLaserEnabled: c.isLaserEnabled ?? false,
          protectAppModified: c.protectAppModified ?? true,
          createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
        },
      });
    }

    const result = { created: 0, updated: 0, unchanged: 0, conflicts: 0, numbersAssigned: 0, photoDuplicates: 0 };

    // Les fiches sont triées par date de modification terrain : les numéros suivent l'ordre d'enrôlement
    for (const p of planned) {
      const { item, field: fe, server } = p;
      if (item.action === 'UNCHANGED') { result.unchanged++; continue; }
      if (item.action === 'CONFLICT') { result.conflicts++; continue; }

      const data: Prisma.EmployeeUncheckedUpdateInput = {
        dynamicData: (fe.dynamicData ?? {}) as Prisma.InputJsonValue,
        photoUrl: fe.photoUrl,
        photoHash: fe.photoHash,
        status: fe.status,
        photoConflict: fe.photoConflict,
        enrolledBy: server?.enrolledBy ?? fe.enrolledBy,
        enrollmentNumber: server?.enrollmentNumber ?? fe.enrollmentNumber,
        isBlocked: fe.isBlocked,
        appModified: fe.appModified,
        externalQrUrl: fe.externalQrUrl,
      };

      if (p.duplicateOfId) {
        data.photoConflict = true;
        data.status = 'A_VERIFIER';
        await tx.employee.update({ where: { id: p.duplicateOfId }, data: { photoConflict: true } });
        result.photoDuplicates++;
      }

      if (item.assignNumber) {
        data.enrollmentNumber = await nextEnrollmentNumber(p.companyId, tx);
        result.numbersAssigned++;
      }

      if (item.action === 'UPDATE' && server) {
        await tx.employee.update({ where: { id: server.id }, data });
        result.updated++;
      } else {
        await tx.employee.create({
          data: {
            ...(data as Prisma.EmployeeUncheckedCreateInput),
            id: fe.id,
            companyId: p.companyId,
            uniqueIdentifier: fe.uniqueIdentifier,
            dynamicData: (fe.dynamicData ?? {}) as Prisma.InputJsonValue,
            createdAt: fe.createdAt ? new Date(fe.createdAt) : undefined,
          },
        });
        result.created++;
      }
    }

    const log = await getSyncLog(tx);
    log.push({ kitId: pkg.manifest.kitId, exportedAt: pkg.manifest.exportedAt, syncedAt: new Date().toISOString(), syncedBy, result });
    const value = log as unknown as Prisma.InputJsonValue;
    await tx.appSetting.upsert({
      where: { key: SYNC_LOG_KEY },
      create: { key: SYNC_LOG_KEY, value },
      update: { value },
    });

    return { ...result, companiesCreated: companiesToCreate.length };
  }, { maxWait: 60000, timeout: 600000 });
}
