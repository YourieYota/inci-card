import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      include: {
        templates: {
          select: { type: true }
        }
      }
    });

    const logs: string[] = [];
    logs.push(`Found ${companies.length} companies.`);
    let totalUnlocked = 0;

    for (const company of companies) {
      const requiredTypes = Array.from(new Set(company.templates.map(t => t.type)));
      logs.push(`Company: ${company.name} - Required template types: [${requiredTypes.join(', ')}]`);

      if (requiredTypes.length === 0) {
        logs.push(`No templates configured for ${company.name}, skipping.`);
        continue;
      }

      // Fetch locked employees for this company
      const lockedEmployees = await prisma.employee.findMany({
        where: {
          companyId: company.id,
          isLocked: true,
        },
        include: {
          printJobs: true
        }
      });

      logs.push(`- Found ${lockedEmployees.length} locked employees.`);

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
          const data = emp.dynamicData as Record<string, any> || {};
          const nom = data.Nom || data.nom || '';
          const prenom = data.Prenom || data.prenom || '';
          logs.push(`  -> Unlocking employee ${emp.uniqueIdentifier} (${nom} ${prenom}): only printed [${Array.from(printedTypes).join(', ')}] but needs [${requiredTypes.join(', ')}]`);
          
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

    logs.push(`Finished unlocking employees. Total unlocked: ${totalUnlocked}`);

    return NextResponse.json({
      success: true,
      totalUnlocked,
      logs
    });
  } catch (error: any) {
    console.error("Failed to fix locks:", error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
