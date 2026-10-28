'use server';

import { prisma } from '@/lib/prisma';
import { verifyAdminAndPassword } from '@/app/actions/backup';
import { assertNotFieldMode, getFieldModeState } from '@/lib/fieldMode';
import { buildFieldKitSql } from '@/lib/fieldKit';

// Kit terrain : voir lib/fieldKit.ts

export async function getKitCompanies() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, _count: { select: { employees: true } } },
    orderBy: { name: 'asc' },
  });
  return companies.map(c => ({ id: c.id, name: c.name, employeeCount: c._count.employees }));
}

export async function exportFieldKit(companyIds: string[], passwordConfirm: string) {
  try {
    const user = await verifyAdminAndPassword(passwordConfirm);
    await assertNotFieldMode("La préparation d'un kit terrain");

    const { sql, exportedAt, counts } = await buildFieldKitSql(companyIds, user.name || user.email);

    const formattedDate = exportedAt.replace(/[:.]/g, '-').slice(0, 19);
    return {
      success: true,
      sqlString: sql,
      filename: `kit-terrain-${formattedDate}.sql`,
      counts,
    };
  } catch (error: any) {
    console.error('Error exporting field kit:', error);
    return { success: false, error: error.message || "Impossible de préparer le kit terrain" };
  }
}

// Informations du kit installé sur ce PC terrain (null sur le serveur principal)
export async function getInstalledFieldKit() {
  const state = await getFieldModeState();
  if (!state.enabled) return null;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: 'fieldKit' } });
    return (row?.value as { exportedAt: string; exportedBy: string; companies: { id: string; name: string }[] } | undefined) ?? null;
  } catch {
    return null;
  }
}
