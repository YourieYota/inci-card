'use client';

/**
 * syncEngine.ts — Moteur de synchronisation bidirectionnelle
 * 
 * MONTANTE (Local → Serveur) : envoie les mutations en attente depuis la SyncQueue.
 * DESCENDANTE (Serveur → Local) : récupère les deltas du serveur et les applique localement.
 * 
 * Utilisé par OfflineBanner.tsx pour déclencher la sync au retour en ligne.
 */

import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';
import { getOfflineQueue, clearOfflineQueue, removeOfflineMutation } from './offlineQueue';

// --- Clés de stockage ---
const CURSOR_KEY_PREFIX = 'inci-sync-cursor:';
const SYNC_LOCK_KEY = 'inci-sync-running';

// --- Types ---
export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

export interface SyncStatus {
  isRunning: boolean;
  lastSyncedAt: string | null; // ISO date string
  pendingCount: number;
  hasConflicts: boolean;
}

// --- Verrou anti-double-sync ---
function acquireSyncLock(): boolean {
  if (typeof window === 'undefined') return false;
  const existing = safeGetItem(SYNC_LOCK_KEY);
  if (existing) {
    // Si le verrou a plus de 2 minutes, on force la libération (crash recovery)
    const ts = parseInt(existing, 10);
    if (Date.now() - ts < 2 * 60 * 1000) return false;
  }
  safeSetItem(SYNC_LOCK_KEY, Date.now().toString());
  return true;
}

function releaseSyncLock(): void {
  safeRemoveItem(SYNC_LOCK_KEY);
}

// --- Curseur de sync descendante ---
function getSyncCursor(table: string): string | null {
  return safeGetItem(`${CURSOR_KEY_PREFIX}${table}`);
}

function setSyncCursor(table: string, isoDate: string): void {
  safeSetItem(`${CURSOR_KEY_PREFIX}${table}`, isoDate);
}

// ============================================================
// SYNC MONTANTE — Local → Serveur
// ============================================================
export async function runUpstreamSync(): Promise<{ pushed: number; errors: string[] }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { pushed: 0, errors: [] };

  const errors: string[] = [];
  let pushed = 0;

  // Import dynamique pour éviter les erreurs SSR
  const { syncOfflineMutations } = await import('@/app/actions/sync');

  // Envoi par batch de 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    try {
      const res = await syncOfflineMutations(batch);
      if (res.success) {
        // Tout le batch a réussi
        batch.forEach(mut => removeOfflineMutation(mut.id));
        pushed += batch.length;
      } else {
        // Traitement partiel : on retire les réussies, on garde les échouées
        res.results.forEach((r: { id: string; success: boolean; error?: string }) => {
          if (r.success) {
            removeOfflineMutation(r.id);
            pushed++;
          } else {
            errors.push(`Mutation ${r.id}: ${r.error || 'Erreur inconnue'}`);
          }
        });
      }
    } catch (err: any) {
      errors.push(err.message || 'Erreur réseau lors du batch sync');
      // On arrête les batches suivants si le réseau est coupé
      break;
    }
  }

  return { pushed, errors };
}

// ============================================================
// SYNC DESCENDANTE — Serveur → Local
// ============================================================
export async function runDownstreamSync(companyId?: string): Promise<{ pulled: number; conflicts: number }> {
  const cursor = getSyncCursor('employees');
  const params = new URLSearchParams();
  if (cursor) params.set('since', cursor);
  if (companyId) params.set('companyId', companyId);

  let pulled = 0;
  let conflicts = 0;

  try {
    const res = await fetch(`/api/sync/pull?${params.toString()}`);
    if (!res.ok) throw new Error(`Pull failed: ${res.status}`);

    const data = await res.json();

    if (data.employees && Array.isArray(data.employees)) {
      // Résolution de conflits et mise à jour du cache local
      const existingRaw = safeGetItem(`inci-cache:employees:${companyId}`);
      const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
      const existingMap = new Map(existing.map((e: any) => [e.id, e]));

      for (const remote of data.employees) {
        const local = existingMap.get(remote.id);

        if (!local) {
          // Nouvel enregistrement du serveur → insérer
          existingMap.set(remote.id, remote);
          pulled++;
        } else {
          // Conflit potentiel : Last-Write-Wins basé sur version
          const remoteVersion = remote.version ?? 0;
          const localVersion = local.version ?? 0;

          if (remoteVersion >= localVersion) {
            // Le serveur est plus récent → il gagne
            existingMap.set(remote.id, remote);
            pulled++;
          } else {
            // Local plus récent (modification non encore synchronisée)
            conflicts++;
          }
        }
      }

      // Mettre à jour le cache local
      const { cleanEmployeesForCache } = await import('./storage');
      const updated = Array.from(existingMap.values());
      safeSetItem(`inci-cache:employees:${companyId}`, JSON.stringify(cleanEmployeesForCache(updated)));
    }

    // Mettre à jour le curseur
    setSyncCursor('employees', new Date().toISOString());

  } catch (err: any) {
    console.warn('[SyncEngine] Downstream sync failed:', err.message);
  }

  return { pulled, conflicts };
}

// ============================================================
// SYNC COMPLÈTE — Montante + Descendante
// ============================================================
export async function runFullSync(companyId?: string): Promise<SyncResult> {
  if (typeof window === 'undefined') {
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: ['SSR context'] };
  }

  if (!navigator.onLine) {
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: ['Hors-ligne'] };
  }

  if (!acquireSyncLock()) {
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: ['Sync déjà en cours'] };
  }

  // Émettre l'événement de début de sync
  window.dispatchEvent(new CustomEvent('inci-sync-start'));

  try {
    // 1. Sync montante d'abord (envoyer nos changements)
    const { pushed, errors } = await runUpstreamSync();

    // 2. Sync descendante (récupérer les changements du serveur)
    const { pulled, conflicts } = await runDownstreamSync(companyId);

    const result: SyncResult = {
      success: errors.length === 0,
      pushed,
      pulled,
      conflicts,
      errors,
    };

    // Mettre à jour la date de dernière sync réussie
    if (result.success) {
      safeSetItem('inci-last-sync', new Date().toISOString());
    }

    // Émettre l'événement de fin de sync
    window.dispatchEvent(new CustomEvent('inci-sync-complete', { detail: result }));

    return result;
  } finally {
    releaseSyncLock();
  }
}

// ============================================================
// STATUT DE SYNC (pour l'affichage dans OfflineBanner)
// ============================================================
export function getSyncStatus(): SyncStatus {
  if (typeof window === 'undefined') {
    return { isRunning: false, lastSyncedAt: null, pendingCount: 0, hasConflicts: false };
  }

  const lockRaw = safeGetItem(SYNC_LOCK_KEY);
  const isRunning = lockRaw ? (Date.now() - parseInt(lockRaw, 10) < 2 * 60 * 1000) : false;
  const lastSyncedAt = safeGetItem('inci-last-sync');
  const queue = getOfflineQueue();
  const hasConflicts = safeGetItem('inci-has-conflicts') === 'true';

  return {
    isRunning,
    lastSyncedAt,
    pendingCount: queue.length,
    hasConflicts,
  };
}
