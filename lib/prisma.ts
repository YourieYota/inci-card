import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';
  
  if (connectionString.includes('neon.tech') || process.env.NODE_ENV === 'production') {
    // Use Neon's HTTP adapter which is perfect for Serverless (no connection limits, no WebSockets required)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaNeonHttp(connectionString, { schema: 'public' } as any);
    return new PrismaClient({ adapter });
  }

  // Fallback for non-Neon local databases if any
  return new PrismaClient();
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
