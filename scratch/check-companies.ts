import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || '';
const adapter = new PrismaNeonHttp(connectionString, { schema: 'public' } as any);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        isLocked: true,
        isLaserEnabled: true,
      }
    });
    console.log('COMPANIES IN DATABASE:');
    console.log(JSON.stringify(companies, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
