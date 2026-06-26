import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const { prisma } = await import('../lib/prisma');

  console.log("=== COMPANIES ===");
  const companies = await prisma.company.findMany();
  console.log(companies.map(c => ({ id: c.id, name: c.name })));

  console.log("=== EMPLOYEES WITH PHOTOS OR NOT A_ENROLER ===");
  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { photoUrl: { not: null } },
        { status: { not: 'A_ENROLER' } }
      ]
    },
    orderBy: { updatedAt: 'desc' },
  });
  console.log(employees.map(e => ({
    id: e.id,
    uniqueIdentifier: e.uniqueIdentifier,
    status: e.status,
    cardNumber: e.cardNumber,
    isLocked: e.isLocked,
    isBlocked: e.isBlocked,
    printCount: e.printCount,
    photoUrl: e.photoUrl,
    companyId: e.companyId,
    updatedAt: e.updatedAt
  })));

  console.log("=== PRINT JOBS ===");
  const printJobs = await prisma.printJob.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(printJobs);
}

main().catch(console.error);
