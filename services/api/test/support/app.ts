import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/adapters/prisma/prisma.service.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { type AppConfig, loadConfig } from '../../src/config/app-config.js';
import { createTestDatabase } from './database.js';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  config: AppConfig;
  close(): Promise<void>;
}

/** Boots the real application against a fresh, migrated database. */
export async function createTestApp(overrides: Partial<Record<string, string>> = {}): Promise<TestApp> {
  const databaseUrl = await createTestDatabase();
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: databaseUrl, ...overrides });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), config, close: () => app.close() };
}
