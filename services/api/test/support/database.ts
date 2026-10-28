import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';
import { TEMPLATE_DATABASE, withDatabase } from '../global-setup.js';

/** Creates an isolated, migrated database (copied from the template) and returns its URL. */
export async function createTestDatabase(): Promise<string> {
  const adminUri = inject('postgresAdminUri');
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: adminUri });
  await admin.connect();
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await admin.query(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DATABASE}`);
        break;
      } catch (error) {
        // Concurrent copies of the same template can collide; retry briefly.
        if (attempt >= 10) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  } finally {
    await admin.end();
  }
  return withDatabase(adminUri, name);
}
