'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyAdminAndPassword, exportDatabaseBackup } from '@/app/actions/backup';
import { assertNotFieldMode } from '@/lib/fieldMode';
import { readFieldSyncPackage, planFieldSync, applyFieldSync } from '@/lib/fieldSync';

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error('Non autorisé. Session utilisateur invalide.');
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if ((user?.role || '').toUpperCase() !== 'ADMIN') {
    throw new Error('Accès refusé : réservé aux administrateurs.');
  }
  return user!;
}

async function readUploadedPackage(formData: FormData) {
  const file = formData.get('file') as File | null;
  if (!file) throw new Error('Aucun fichier fourni.');
  return readFieldSyncPackage(await file.arrayBuffer());
}

// L'export (PC terrain) est servi par la route /api/field-sync/export : le .zip est trop lourd
// pour transiter par une action serveur.

// Serveur principal : aperçu de ce que la synchronisation va faire, sans rien écrire
export async function analyzeFieldSync(formData: FormData) {
  try {
    await requireAdminSession();
    await assertNotFieldMode('La synchronisation');
    const pkg = await readUploadedPackage(formData);
    return { success: true, plan: await planFieldSync(pkg) };
  } catch (error: any) {
    console.error('Error analyzing field sync:', error);
    return { success: false, error: error.message || "Impossible d'analyser le fichier" };
  }
}

// Serveur principal : sauvegarde complète puis application de la synchronisation
export async function applyFieldSyncFromFile(formData: FormData) {
  try {
    const passwordConfirm = formData.get('passwordConfirm') as string;
    const user = await verifyAdminAndPassword(passwordConfirm);
    await assertNotFieldMode('La synchronisation');
    const pkg = await readUploadedPackage(formData);

    const backup = await exportDatabaseBackup(passwordConfirm);
    if (!backup.success) {
      throw new Error(`Sauvegarde préalable impossible, synchronisation annulée : ${backup.error}`);
    }

    const result = await applyFieldSync(pkg, user.name || user.email);
    revalidatePath('/', 'layout');
    return { success: true, result, backupFilename: backup.filename };
  } catch (error: any) {
    console.error('Error applying field sync:', error);
    return { success: false, error: error.message || 'Échec de la synchronisation' };
  }
}
