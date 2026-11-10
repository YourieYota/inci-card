import { prisma } from '@/lib/prisma';

/**
 * Empreinte de la liste d'employés d'une entreprise : nombre de fiches + dernière
 * modification. Elle change dès qu'un poste ajoute, modifie (photo comprise) ou
 * supprime une fiche, ce qui permet aux autres postes de savoir quand recharger.
 */
export async function getEmployeesVersion(companyId: string): Promise<string> {
  const agg = await prisma.employee.aggregate({
    where: { companyId },
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  return `${agg._count._all}:${agg._max.updatedAt?.toISOString() ?? ''}`;
}
