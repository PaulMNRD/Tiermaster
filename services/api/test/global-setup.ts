import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

export const TEMPLATE_DATABASE = 'tiermaster_template';

/** Starts one PostgreSQL container for the whole run and prepares a migrated template database. */
export default async function setup(project: TestProject) {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:18-alpine').start();
  const adminUri = container.getConnectionUri();

  const admin = new pg.Client({ connectionString: adminUri });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`);
  await admin.end();

  const template = new pg.Client({ connectionString: withDatabase(adminUri, TEMPLATE_DATABASE) });
  await template.connect();
  const migrationsDir = join(import.meta.dirname, '../prisma/migrations');
  for (const dir of readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    await template.query(readFileSync(join(migrationsDir, dir, 'migration.sql'), 'utf8'));
  }
  await template.end();

  project.provide('postgresAdminUri', adminUri);
  return async () => {
    await container.stop();
  };
}

export function withDatabase(uri: string, database: string): string {
  const url = new URL(uri);
  url.pathname = `/${database}`;
  return url.toString();
}

declare module 'vitest' {
  export interface ProvidedContext {
    postgresAdminUri: string;
  }
}
