import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const allEmps = await prisma.employee.findMany({
    select: {
      id: true,
      status: true,
      enrolledBy: true,
      printedBy: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  console.log('--- LATEST 20 EMPLOYEES BY UPDATE TIME ---');
  console.dir(allEmps, { depth: null });

  const nullCounts = await prisma.employee.groupBy({
    by: ['status'],
    _count: {
      enrolledBy: true,
      printedBy: true,
      id: true,
    }
  });
  console.log('--- STATS BY STATUS ---');
  console.dir(nullCounts, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
