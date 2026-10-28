import type { INestApplication } from '@nestjs/common';

/** Shared by main.ts and the integration tests, so both run the same HTTP pipeline. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}
