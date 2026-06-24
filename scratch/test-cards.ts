import { prisma } from '../lib/prisma';

async function main() {
  // 1. Test getCardCategories equivalent (with include: { format: true })
  console.log("=== TEST 1: getCardCategories (include format) ===");
  try {
    const categories = await prisma.cardCategory.findMany({
      where: {
        OR: [
          { companyId: null },
          { companyId: null }
        ]
      },
      include: {
        format: true,
      },
      orderBy: { name: 'asc' },
    });
    console.log("Categories with format:", JSON.stringify(categories, null, 2));
  } catch (error: any) {
    console.error("ERROR in getCardCategories:", error.message);
  }

  // 2. Test creating a new category
  console.log("\n=== TEST 2: createCardCategory ===");
  try {
    // First get a format to reference
    const format = await prisma.cardFormat.findFirst();
    if (!format) {
      console.error("No format found, cannot create category");
      return;
    }
    console.log("Using format:", format.id, format.name);

    const catName = "Test-Auto-" + Date.now();
    const slug = catName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    const category = await prisma.cardCategory.create({
      data: {
        name: catName,
        slug,
        color: '#6366f1',
        description: null,
        formatId: format.id,
        companyId: null,
      },
    });
    console.log("Created category:", category);

    // Fetch with format
    const fullCat = await prisma.cardCategory.findUnique({
      where: { id: category.id },
      include: { format: true },
    });
    console.log("Category with format:", JSON.stringify(fullCat, null, 2));

    // Clean up
    await prisma.cardCategory.delete({ where: { id: category.id } });
    console.log("Cleaned up test category");
  } catch (error: any) {
    console.error("ERROR in createCardCategory:", error.message, error.code);
  }

  // 3. Test getCardFormats
  console.log("\n=== TEST 3: getCardFormats ===");
  try {
    const formats = await prisma.cardFormat.findMany({
      where: {
        OR: [
          { companyId: null },
          { companyId: null }
        ]
      },
      orderBy: { name: 'asc' },
    });
    console.log("Formats:", JSON.stringify(formats, null, 2));
  } catch (error: any) {
    console.error("ERROR in getCardFormats:", error.message);
  }

  // 4. Test getCardPhysicalTypes
  console.log("\n=== TEST 4: getCardPhysicalTypes ===");
  try {
    const types = await prisma.cardPhysicalType.findMany({
      where: {
        OR: [
          { companyId: null },
          { companyId: null }
        ]
      },
      orderBy: { name: 'asc' },
    });
    console.log("Physical types:", JSON.stringify(types, null, 2));
  } catch (error: any) {
    console.error("ERROR in getCardPhysicalTypes:", error.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
