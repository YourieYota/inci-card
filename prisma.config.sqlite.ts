import 'dotenv/config';
import { defineConfig } from '@prisma/config';
import path from 'path';

// Configuration Prisma pour le mode installation locale (SQLite)
// Utilisé avec : npx prisma migrate dev --config prisma.config.sqlite.ts

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.sqlite.prisma'),
  datasource: {
    url: process.env.DATABASE_URL || `file:${path.join(__dirname, 'data', 'inci-card.db')}`,
  },
});
