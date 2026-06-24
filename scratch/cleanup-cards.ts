import { prisma } from '../lib/prisma';

async function main() {
  // Clean up the malformed category with duplicated name
  const badCat = await prisma.cardCategory.findFirst({
    where: { name: { contains: 'Category A6 TestCategory A6 Test' } }
  });
  if (badCat) {
    await prisma.cardCategory.delete({ where: { id: badCat.id } });
    console.log("Deleted malformed category:", badCat.name);
  } else {
    console.log("No malformed category found.");
  }

  // Show final state
  console.log("\n=== FINAL STATE ===");
  console.log("\nFormats:");
  const formats = await prisma.cardFormat.findMany({ orderBy: { name: 'asc' } });
  formats.forEach(f => console.log(`  - ${f.name} (${f.width}x${f.height} ${f.unit}) [company: ${f.companyId || 'global'}]`));

  console.log("\nCategories:");
  const categories = await prisma.cardCategory.findMany({ include: { format: true }, orderBy: { name: 'asc' } });
  categories.forEach(c => console.log(`  - ${c.name} → format: ${c.format.name} [company: ${c.companyId || 'global'}]`));

  console.log("\nPhysical Types:");
  const ptypes = await prisma.cardPhysicalType.findMany({ orderBy: { name: 'asc' } });
  ptypes.forEach(p => console.log(`  - ${p.name} (code: ${p.cardCode}) [company: ${p.companyId || 'global'}]`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
