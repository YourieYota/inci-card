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
      getUsers(),
    ]);

    // Fetch all templates
    const templates = await prisma.cardTemplate.findMany({});

    // Fetch all employees
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
    });

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
