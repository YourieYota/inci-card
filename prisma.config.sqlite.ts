import { defineConfig } from '@prisma/config';
import path from 'path';

// Configuration Prisma pour le mode installation locale (LibSQL/SQLite)
// Prisma 7 utilise LibSQL comme adaptateur SQLite via @prisma/adapter-libsql
// URL format : file:/absolute/path/to/db ou file:relative/path.db

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.sqlite.prisma'),
  datasource: {
    url: process.env.DATABASE_URL || `file:${path.join(__dirname, 'data', 'inci-card.db')}`,
  },
});
