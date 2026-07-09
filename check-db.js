const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.cardCategory.count({
    where: { companyId: null }
  });
  console.log('Global Categories Count:', count);
}

main().finally(() => prisma.$disconnect());
