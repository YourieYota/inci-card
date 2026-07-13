import dotenv from 'dotenv';
// Load environment variables from .env.local and .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { prisma } from '../lib/prisma';

async function main() {
  // 1. Get all companies
  const companies = await prisma.company.findMany({
    include: {
      templates: {
        select: { type: true }
      }
    }
  });

  console.log(`Found ${companies.length} companies.`);
  let totalUnlocked = 0;

  for (const company of companies) {
    const requiredTypes = Array.from(new Set(company.templates.map(t => t.type)));
    console.log(`Company: ${company.name} - Required template types: [${requiredTypes.join(', ')}]`);

    if (requiredTypes.length === 0) {
      console.log(`No templates configured for ${company.name}, skipping.`);
      continue;
    }

    // 2. Fetch locked employees for this company
    const lockedEmployees = await prisma.employee.findMany({
      where: {
        companyId: company.id,
        isLocked: true,
      },
      include: {
        printJobs: true
      }
    });

    console.log(`- Found ${lockedEmployees.length} locked employees.`);

    for (const emp of lockedEmployees) {
      // Get template types actually printed (excluding REIMPRESSION_DEMANDEE placeholder)
      const printedTypes = new Set(
        emp.printJobs
          .filter(j => j.cardNumber !== 'REIMPRESSION_DEMANDEE')
          .map(j => j.templateType)
      );

      // Check if all required templates have been printed
      const allPrinted = requiredTypes.every(t => printedTypes.has(t));

      if (!allPrinted) {
        // Unlock this employee!
        const data = emp.dynamicData as Record<string, any> || {};
        const nom = data.Nom || data.nom || '';
        const prenom = data.Prenom || data.prenom || '';
        console.log(`  -> Unlocking employee ${emp.uniqueIdentifier} (${nom} ${prenom}): only printed [${Array.from(printedTypes).join(', ')}] but needs [${requiredTypes.join(', ')}]`);
        
        await prisma.employee.update({
          where: { id: emp.id },
          data: {
            isLocked: false,
            status: emp.status === 'REIMPRIME' ? 'REIMPRESSION' : 'IMPRIME'
          }
        });
        totalUnlocked++;
      }
    }
  }

  console.log(`\n✅ Finished unlocking employees. Total unlocked: ${totalUnlocked}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
