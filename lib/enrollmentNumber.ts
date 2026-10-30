import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

// Numéro d'enrôlement séquentiel par entreprise. Accepte un client de transaction
// pour que les numéros attribués en série (synchronisation) se suivent.
export async function nextEnrollmentNumber(companyId: string, db: Db = prisma): Promise<string> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { identifierPrefix: true },
  });

  const count = await db.employee.count({
    where: {
      companyId: companyId,
      enrollmentNumber: { not: null }
    },
  });

  if (company?.identifierPrefix) {
    const prefix = company.identifierPrefix;
    const num = String(count + 1).padStart(3, '0');
    return `${prefix}${num}`;
  }

  const docType = await db.cardDocumentType.findFirst({
    where: {
      companyId: companyId || null,
      cardCode: { not: "" }
    },
    orderBy: { createdAt: 'asc' },
  });

  if (docType && docType.cardCode) {
    const num = String(count + 1).padStart(4, '0');
    return `${docType.cardCode}${num}`;
  }

  const num = String(count + 1).padStart(5, '0');
  return `INCI-ENR-${new Date().getFullYear()}-${num}`;
}
