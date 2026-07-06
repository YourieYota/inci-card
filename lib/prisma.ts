import { PrismaClient } from '@prisma/client';

// Mode SQLite (installation locale) : pas d'adaptateur externe nécessaire
// Mode PostgreSQL (cloud/LAN) : adaptateurs Neon HTTP ou pg
const DB_PROVIDER = process.env.DB_PROVIDER || 'postgresql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = async (): Promise<PrismaClient> => {
  // Mode SQLite — utilisé pour les installations locales (.exe)
  if (DB_PROVIDER === 'sqlite') {
    return new PrismaClient();
  }

  // Mode PostgreSQL — utilisé pour le serveur cloud (Render, Neon) ou LAN
  const connectionString = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';

  if (connectionString.includes('neon.tech')) {
    const { PrismaNeonHttp } = await import('@prisma/adapter-neon');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaNeonHttp(connectionString, { schema: 'public' } as any);
    return new PrismaClient({ adapter });
  }

  // Render ou PostgreSQL local (Docker / LAN)
  const pg = await import('pg');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const pool = new pg.default.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

// Singleton — évite les connexions multiples en dev (HMR Next.js)
let prismaInstance: PrismaClient | undefined;

export const getPrisma = async (): Promise<PrismaClient> => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (prismaInstance) return prismaInstance;

  prismaInstance = await createPrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }

  return prismaInstance;
};

// Export synchrone pour compatibilité avec le code existant
// (sera remplacé progressivement par getPrisma())
import { PrismaClient as PrismaClientSync } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const createPrismaClientSync = () => {
  if (DB_PROVIDER === 'sqlite') {
    return new PrismaClientSync();
  }

  const connectionString = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';

  if (connectionString.includes('neon.tech')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaNeonHttp(connectionString, { schema: 'public' } as any);
    return new PrismaClientSync({ adapter });
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClientSync({ adapter });
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClientSync();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
