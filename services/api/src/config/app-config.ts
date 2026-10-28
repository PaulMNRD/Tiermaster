import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

const DEV_SESSION_SECRET = 'dev-only-session-secret-change-me-in-production';

export const AppConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.string().min(1),
    /** Public origin of the application (SPA and API share it behind the reverse proxy). */
    PUBLIC_URL: z.url().default('http://localhost:4200'),
    SESSION_SECRET: z.string().min(32).default(DEV_SESSION_SECRET),
    COOKIE_SECURE: booleanString,
    /** Enables the fake OAuth provider (development and tests only). */
    AUTH_FAKE_ENABLED: booleanString,
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    STEAM_API_KEY: z.string().optional(),
    /** `s3` (Garage or any S3 API) or `memory` (tests; development without Garage). Defaults to s3 when S3_ENDPOINT is set. */
    STORAGE_DRIVER: z.enum(['s3', 'memory']).optional(),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_BUCKET: z.string().default('tiermaster-images'),
    S3_FORCE_PATH_STYLE: booleanString,
  })
  .transform((config) => ({ ...config, STORAGE_DRIVER: config.STORAGE_DRIVER ?? (config.S3_ENDPOINT ? 's3' : 'memory') }))
  .superRefine((config, ctx) => {
    if (config.STORAGE_DRIVER === 's3' && !(config.S3_ENDPOINT && config.S3_ACCESS_KEY && config.S3_SECRET_KEY)) {
      ctx.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY are required by the s3 driver' });
    }
    if (config.NODE_ENV !== 'production') return;
    if (config.STORAGE_DRIVER !== 's3') {
      ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'must be s3 in production' });
    }
    if (config.SESSION_SECRET === DEV_SESSION_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'must be set in production' });
    }
    if (config.AUTH_FAKE_ENABLED) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_FAKE_ENABLED'], message: 'must be false in production' });
    }
  });
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return AppConfigSchema.parse(env);
}
