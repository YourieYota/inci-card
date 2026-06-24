import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}

const adapter = new PrismaNeonHttp(connectionString, { schema: 'public' } as any);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const id = '2e6a0226-dc7f-4c98-835e-ef3986a3aacc';
    const employee = await prisma.employee.findUnique({
      where: { id }
    });

    if (employee) {
      console.log('Employee id:', employee.id);
      console.log('photoUrl:', employee.photoUrl);
      console.log('enrollmentNumber:', employee.enrollmentNumber);
      console.log('status:', employee.status);
    } else {
      console.log('Employee not found with id:', id);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
