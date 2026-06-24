import { prisma } from '../lib/prisma';

async function main() {
  // Get ALL employees grouped by company
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      dynamicData: true,
      companyId: true,
    }
  });

  console.log("Total employees:", employees.length);

  // Group by company
  const byCompany = new Map<string, typeof employees>();
  employees.forEach((emp) => {
    const cid = emp.companyId || 'none';
    if (!byCompany.has(cid)) byCompany.set(cid, []);
    byCompany.get(cid)!.push(emp);
  });

  // Get company names
  const companies = await prisma.company.findMany();
  const nameMap = new Map<string, string>();
  companies.forEach(c => nameMap.set(c.id, c.name));

  byCompany.forEach((emps, companyId) => {
    const companyName = nameMap.get(companyId) || companyId;
    console.log(`\n=== ${companyName} (${emps.length} employees) ===`);

    // Collect ALL unique keys for this company
    const allKeys = new Set<string>();
    emps.forEach((emp) => {
      const data = emp.dynamicData as Record<string, any> | null;
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(k => allKeys.add(k));
      }
    });
    console.log("  All keys:", JSON.stringify(Array.from(allKeys)));
    
    // Now check: for each employee, which keys from allKeys are NOT in their dynamicData?
    // This reveals if some employees have keys that others don't, creating empty fields
    const sample = emps[0];
    if (sample) {
      const sampleData = sample.dynamicData as Record<string, any>;
      const sampleKeys = sampleData ? new Set(Object.keys(sampleData)) : new Set<string>();
      const missing = Array.from(allKeys).filter(k => !sampleKeys.has(k));
      if (missing.length > 0) {
        console.log(`  Sample employee ${sample.id} is MISSING keys:`, missing);
        console.log(`  Sample employee has keys:`, Array.from(sampleKeys));
      }
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
