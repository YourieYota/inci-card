import { prisma } from '../lib/prisma';

async function main() {
  const employees = await prisma.employee.findMany({
    take: 5,
    include: { company: true }
  });
  console.log(employees.map(e => ({ id: e.id, name: e.uniqueIdentifier, company: e.company.name })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
