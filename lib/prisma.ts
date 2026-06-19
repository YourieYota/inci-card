import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Intercept and downgrade server-side Prisma connection/timeout errors in development
// to prevent Next.js from displaying a Redbox overlay on client browsers.
if (typeof window === "undefined" && process.env.NODE_ENV === "development") {
  const origError = console.error;
  console.error = (...args: any[]) => {
    const isDbOfflineWarning = args.some(arg => {
      if (!arg) return false;
      
      if (arg instanceof Error) {
        const name = arg.name || "";
        const msg = arg.message || "";
        const stack = arg.stack || "";
        return (
          name.includes("Prisma") ||
          msg.includes("ETIMEDOUT") ||
          msg.includes("Can't reach database") ||
          msg.includes("prisma") ||
          stack.includes("Prisma")
        );
      }
      
      if (typeof arg === "string") {
        return (
          arg.includes("ETIMEDOUT") ||
          arg.includes("PrismaClientKnownRequestError") ||
          arg.includes("PrismaClientInitializationError") ||
          arg.includes("PrismaClientUnknownRequestError") ||
          arg.includes("prisma") ||
          arg.includes("SECURITY WARNING: The SSL modes") ||
          arg.includes("pg-connection-string") ||
          arg.includes("sslmode")
        );
      }
      
      const strVal = String(arg);
      return (
        strVal.includes("Prisma") ||
        strVal.includes("ETIMEDOUT") ||
        strVal.includes("prisma") ||
        strVal.includes("SECURITY WARNING: The SSL modes") ||
        strVal.includes("sslmode")
      );
    });

    if (isDbOfflineWarning) {
      console.warn("[DB Intercepted Warning]:", ...args);
      return;
    }
    origError.apply(console, args);
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
