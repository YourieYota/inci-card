import { prisma } from '../lib/prisma';

async function main() {
  // Get ALL employees
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      dynamicData: true,
    }
  });

  console.log(`Processing ${employees.length} employees...`);
  let fixedCount = 0;

  for (const emp of employees) {
    const data = emp.dynamicData as Record<string, any> | null;
    if (!data || typeof data !== 'object') continue;

    const keys = Object.keys(data);
    const needsFix = keys.some(k => k !== k.trim());

    if (!needsFix) continue;

    // Build normalized data object with trimmed keys
    const normalizedData: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      const trimmedKey = key.trim();
      if (!trimmedKey) continue;
      // If this trimmed key already exists, prefer the non-empty value
      if (trimmedKey in normalizedData) {
        const existing = normalizedData[trimmedKey];
        if (existing !== undefined && existing !== null && existing !== '') {
          continue; // Keep existing non-empty value
        }
      }
      normalizedData[trimmedKey] = val;
    }

    // Update in database
    await prisma.employee.update({
      where: { id: emp.id },
      data: { dynamicData: normalizedData },
    });
    fixedCount++;
  }

  console.log(`\n✅ Fixed ${fixedCount} employees with untrimmed keys.`);
  console.log(`   ${employees.length - fixedCount} employees were already clean.`);

  // Verify: check for any remaining untrimmed keys
  const verifyEmployees = await prisma.employee.findMany({
    select: { id: true, dynamicData: true },
  });
  let remaining = 0;
  verifyEmployees.forEach((emp) => {
    const data = emp.dynamicData as Record<string, any> | null;
    if (data && typeof data === 'object') {
      Object.keys(data).forEach((k) => {
        if (k !== k.trim()) remaining++;
      });
    }
  });
  console.log(`\nVerification: ${remaining} untrimmed keys remaining.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
