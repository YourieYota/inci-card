'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { verifyAdminAndPassword } from '@/app/actions/backup';
import {
  getFieldModeState,
  saveFieldModeState,
  countPendingFieldRecords,
  FieldModeState,
} from '@/lib/fieldMode';

export async function getFieldMode(): Promise<FieldModeState & { pendingCount: number }> {
  const state = await getFieldModeState();
  let pendingCount = 0;
  try {
    pendingCount = await countPendingFieldRecords(state);
  } catch (error) {
    console.warn('Comptage des fiches terrain impossible :', error);
  }
  return { ...state, pendingCount };
}

/**
 * Active le mode terrain. Si la base contient déjà des enrôlements numérotés
 * (signe probable du serveur principal), une confirmation explicite est exigée.
 */
export async function enableFieldMode(passwordConfirm: string, confirmNumberedData = false) {
  try {
    const user = await verifyAdminAndPassword(passwordConfirm);

    const current = await getFieldModeState();
    if (current.enabled) return { success: true };

    if (!confirmNumberedData) {
      const numberedCount = await prisma.employee.count({ where: { enrollmentNumber: { not: null } } });
      if (numberedCount > 0) {
        return { success: false, needsConfirmation: true, numberedCount };
      }
    }

    await saveFieldModeState({
      enabled: true,
      since: new Date().toISOString(),
      lastExportAt: null,
      enabledBy: user.name || user.email,
    });
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: any) {
    console.error('Error enabling field mode:', error);
    return { success: false, error: error.message || "Impossible d'activer le mode terrain" };
  }
}

/**
 * Désactive le mode terrain, uniquement si toutes les fiches terrain ont été exportées.
 */
export async function disableFieldMode(passwordConfirm: string) {
  try {
    await verifyAdminAndPassword(passwordConfirm);

    const current = await getFieldModeState();
    if (!current.enabled) return { success: true };

    const pendingCount = await countPendingFieldRecords(current);
    if (pendingCount > 0) {
      throw new Error(
        `${pendingCount} fiche(s) enrôlée(s) ou modifiée(s) sur le terrain n'ont pas été exportées. Exportez les données terrain avant de quitter ce mode.`
      );
    }

    await saveFieldModeState({ ...current, enabled: false });
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: any) {
    console.error('Error disabling field mode:', error);
    return { success: false, error: error.message || 'Impossible de désactiver le mode terrain' };
  }
}
