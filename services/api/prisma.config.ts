import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node dist/seed/main.js',
  },
  datasource: {
    // Not required by `prisma generate`; required by migrate commands.
    url: process.env.DATABASE_URL ?? '',
  },
});
