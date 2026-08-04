import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://incicard:incicard_secret_pass@db:5432/incicard_db?sslmode=disable',
  },
});
