import { prisma } from '../lib/prisma';

async function main() {
  console.log("=== COMPANIES ===");
  const companies = await prisma.company.findMany();
  console.log(companies.map(c => ({ id: c.id, name: c.name })));

  console.log("=== FORMATS ===");
  const formats = await prisma.cardFormat.findMany();
  console.log(formats.map(f => ({ id: f.id, name: f.name, companyId: f.companyId })));

  console.log("=== CATEGORIES ===");
  const categories = await prisma.cardCategory.findMany();
  console.log(categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, companyId: c.companyId })));

  console.log("=== PHYSICAL TYPES ===");
  const ptypes = await prisma.cardPhysicalType.findMany();
  console.log(ptypes.map(p => ({ id: p.id, name: p.name, slug: p.slug, companyId: p.companyId })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
