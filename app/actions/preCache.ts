'use server';

import { prisma } from '@/lib/prisma';
import { getCompaniesWithCounts } from '@/app/actions/templates';
import { getRoles } from '@/app/actions/roles';
import { getUsers } from '@/app/actions/users';

export async function fetchAllPreCacheData() {
  try {
    const [companies, roles, users] = await Promise.all([
      getCompaniesWithCounts(),
      getRoles(),
      // Réservé aux administrateurs : pour un agent, on met en cache tout le reste
      getUsers().catch(() => []),
    ]);

    // Fetch all templates
    const templates = await prisma.cardTemplate.findMany({});

    // Fetch all employees, sans les images (base64) : le cache local les retire de
    // toute façon, et les transférer bloquait les autres actions serveur de la page
    // (elles sont exécutées une par une) pendant de longues secondes.
    const [employeeRows, withPhoto] = await Promise.all([
      prisma.employee.findMany({
        omit: { photoUrl: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.findMany({
        where: { photoUrl: { not: null }, NOT: { photoUrl: '' } },
        select: { id: true },
      }),
    ]);
    const photoIds = new Set(withPhoto.map((e) => e.id));
    const employees = employeeRows.map((emp) => ({ ...emp, hasPhoto: photoIds.has(emp.id) }));

    return {
      success: true,
      companies,
      roles,
      users,
      templates,
      employees,
    };
  } catch (error) {
    console.warn("Pre-cache fetch failed:", error);
    return { success: false, error: 'Database fetch failed' };
  }
}
