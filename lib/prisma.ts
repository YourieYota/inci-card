/**
 * lib/prisma.ts — Client Prisma dual-mode (PostgreSQL / SQLite via LibSQL)
 *
 * PRISMA 7 : Le moteur embarqué a été supprimé — TOUS les providers nécessitent un adaptateur.
 *
 * Modes :
 *   DB_PROVIDER=postgresql (défaut) → adaptateur Neon HTTP (Neon) ou pg (Render/Docker/LAN)
 *   DB_PROVIDER=sqlite              → adaptateur LibSQL (fichier local .db)
 *
 * Le client `prisma` est initialisé de façon LAZY (Proxy) pour éviter les erreurs
 * lors du build Next.js (phase de collecte des pages statiques).
 */

import { PrismaClient } from '@prisma/client';

const DB_PROVIDER = process.env.DB_PROVIDER || 'postgresql';

const globalForPrisma = globalThis as unknown as {
  prismaClient: PrismaClient | undefined;
};

// ============================================================
// FACTORY — crée le bon adaptateur selon le provider
// ============================================================
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || '';

  // --- SQLite via LibSQL (installations locales .exe) ---
  if (DB_PROVIDER === 'sqlite') {
    const { createClient: createLibSQLClient } = require('@libsql/client');
    const { PrismaLibSql } = require('@prisma/adapter-libsql');

    const url = connectionString || `file:${process.cwd()}/data/inci-card.db`;
    const libsql = createLibSQLClient({ url });
    const adapter = new PrismaLibSql(libsql);
    return new PrismaClient({ adapter });
  }

  // --- PostgreSQL Neon HTTP (cloud Neon) ---
  if (connectionString.includes('neon.tech')) {
    const { PrismaNeonHttp } = require('@prisma/adapter-neon');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaNeonHttp(connectionString, { schema: 'public' } as any);
    return new PrismaClient({ adapter });
  }

  // --- PostgreSQL via pg (Render, Docker, LAN) ---
  const pg = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// ============================================================
// SINGLETON LAZY — évite les connexions multiples (HMR Next.js)
// ============================================================
function getClient(): PrismaClient {
  if (globalForPrisma.prismaClient) return globalForPrisma.prismaClient;

  const client = createClient();

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prismaClient = client;
  }

  return client;
}

// ============================================================
// EXPORT PRINCIPAL — Proxy lazy pour compatibilité code existant
//
// Le Proxy intercepte tous les accès (`prisma.user.findMany(...)`)
// et initialise le vrai client Prisma au premier accès.
// Cela évite les erreurs de build Next.js (le module est importé
// mais le client n'est créé qu'au moment d'une vraie requête).
// ============================================================
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// ============================================================
// EXPORT ASYNC (pour les cas qui peuvent attendre)
// ============================================================
export async function getPrisma(): Promise<PrismaClient> {
  return getClient();
}
