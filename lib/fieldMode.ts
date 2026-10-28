import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Mode terrain : instance hors ligne utilisée pour les enrôlements hors de l'entreprise.
// Les numéros d'enrôlement n'y sont pas générés ; ils sont attribués à la synchronisation
// sur le serveur principal.

const FIELD_MODE_KEY = 'fieldMode';

export interface FieldModeState {
  enabled: boolean;
  since: string | null;        // Date d'activation (ISO) : les fiches modifiées après sont "terrain"
  lastExportAt: string | null; // Dernier export des données terrain (ISO)
  enabledBy: string | null;
}

const DEFAULT_STATE: FieldModeState = {
  enabled: false,
  since: null,
  lastExportAt: null,
  enabledBy: null,
};

export async function getFieldModeState(): Promise<FieldModeState> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: FIELD_MODE_KEY } });
    if (!row) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...(row.value as Partial<FieldModeState>) };
  } catch (error) {
    // Table absente (schéma pas encore appliqué) : on reste en mode serveur
    console.warn('Lecture du mode terrain impossible, mode serveur par défaut :', error);
    return DEFAULT_STATE;
  }
}

// Crée la table si le schéma n'a pas été appliqué (évite un `prisma db push` manuel sur chaque installation)
export async function ensureAppSettingTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AppSetting" (
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
    )
  `);
}

export async function saveFieldModeState(state: FieldModeState) {
  await ensureAppSettingTable();
  const value = state as unknown as Prisma.InputJsonObject;
  await prisma.appSetting.upsert({
    where: { key: FIELD_MODE_KEY },
    create: { key: FIELD_MODE_KEY, value },
    update: { value },
  });
}

// Fiches créées ou modifiées en mode terrain et pas encore exportées
export async function countPendingFieldRecords(state: FieldModeState): Promise<number> {
  if (!state.enabled || !state.since) return 0;
  const after = state.lastExportAt && state.lastExportAt > state.since ? state.lastExportAt : state.since;
  return prisma.employee.count({ where: { updatedAt: { gt: new Date(after) } } });
}

export async function assertNotFieldMode(actionLabel: string) {
  const state = await getFieldModeState();
  if (state.enabled) {
    throw new Error(`${actionLabel} est indisponible en mode terrain. Cette action se fera sur le serveur principal après synchronisation.`);
  }
}
