import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';
  
  if (connectionString.includes('neon.tech')) {
    // Use Neon's HTTP adapter which is perfect for Serverless (no connection limits, no WebSockets required)
    const neonConnection = neon(connectionString);
    const adapter = new PrismaNeon(neonConnection);
    return new PrismaClient({ adapter });
  }

  // Use standard pg adapter for Render or local postgres since the client is in WASM/client-only engine mode
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
