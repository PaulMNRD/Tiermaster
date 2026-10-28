import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Tests run against the shared sources, so they never depend on a stale build.
    alias: { '@tiermaster/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) },
  },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    // Unit tests run in milliseconds; integration tests share one PostgreSQL container (Testcontainers).
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
