import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

const adapter = new PrismaNeonHttp('postgresql://dummy:dummy@localhost:5432/dummy');
const prisma = new PrismaClient({ adapter });

prisma.$connect()
  .then(() => console.log('success'))
  .catch(console.error);
