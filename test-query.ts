import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

const connectionString = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';
const adapter = new PrismaNeonHttp(connectionString);
const prisma = new PrismaClient({ adapter });

prisma.company.findMany()
  .then(res => console.log('Found:', res.length))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
