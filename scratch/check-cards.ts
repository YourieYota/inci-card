import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  console.log('--- CARD FORMATS ---');
  const formats = await prisma.cardFormat.findMany();
  console.dir(formats, { depth: null });

  console.log('--- CARD CATEGORIES ---');
  const categories = await prisma.cardCategory.findMany({
    include: { format: true }
  });
  console.dir(categories, { depth: null });

  console.log('--- CARD PHYSICAL TYPES ---');
  const physicalTypes = await prisma.cardPhysicalType.findMany();
  console.dir(physicalTypes, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
