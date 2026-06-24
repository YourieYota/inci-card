import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const users = await prisma.user.findMany();
  console.log('--- USERS IN DATABASE ---');
  console.dir(users, { depth: null });
  
  const employees = await prisma.employee.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' }
  });
  console.log('--- LATEST 5 EMPLOYEES ---');
  console.dir(employees, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
