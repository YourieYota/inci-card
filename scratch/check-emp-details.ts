import { prisma } from '../lib/prisma';

async function main() {
  const emp = await prisma.employee.findUnique({
    where: { id: '1bc33cca-c7af-4099-9748-94cf5e947f8f' },
    include: { company: true }
  });
  console.log('Employee details:', JSON.stringify(emp, null, 2));
}

main().catch(console.error);
