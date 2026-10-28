import type { CookieOptions } from 'express';
import type { AppConfig } from '../config/app-config.js';

export const SESSION_COOKIE = 'tm_session';

export function cookieOptions(config: Pick<AppConfig, 'COOKIE_SECURE'>): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: config.COOKIE_SECURE, path: '/' };
}
