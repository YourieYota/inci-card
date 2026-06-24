import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  console.log('--- STARTING RETROACTIVE HISTORY FIX (LOOPED UPDATES) ---');

  // Fetch employees that need updates
  const employeesToUpdate = await prisma.employee.findMany({
    where: {
      OR: [
        { enrolledBy: null },
        { status: 'IMPRIME', printedBy: null }
      ]
    },
    select: { id: true, status: true, enrolledBy: true, printedBy: true }
  });

  console.log(`Found ${employeesToUpdate.length} employees requiring history updates.`);

  let updatedCount = 0;
  for (const emp of employeesToUpdate) {
    const data: any = {};
    if (emp.enrolledBy === null) {
      data.enrolledBy = 'Administrateur';
    }
    if (emp.status === 'IMPRIME' && emp.printedBy === null) {
      data.printedBy = 'Administrateur';
    }
    
    if (Object.keys(data).length > 0) {
      await prisma.employee.update({
        where: { id: emp.id },
        data
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated history for ${updatedCount} employees.`);
  console.log('--- RETROACTIVE HISTORY FIX COMPLETE ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
