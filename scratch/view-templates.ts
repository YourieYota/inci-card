import { prisma } from '../lib/prisma';

async function main() {
  console.log("=== CARD TEMPLATES ===");
  const templates = await prisma.cardTemplate.findMany({
    include: {
      company: true,
      category: true,
    }
  });
  console.log(templates.map(t => ({
    id: t.id,
    company: t.company.name,
    type: t.type,
    categoryId: t.categoryId,
    categoryName: t.category?.name,
    width: t.width,
    height: t.height,
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
