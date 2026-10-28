import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import type { AuthenticatedRequest } from './auth.js';
import { apiError } from './errors.js';

export type RateLimitBucket = 'write' | 'upload' | 'search';
const RATE_LIMIT = 'tm:rate-limit';
const WINDOW_MS = 60_000;
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Puts a route in a specific bucket. Without it, every mutating request counts as a `write`. */
export const RateLimit = (bucket: RateLimitBucket) => SetMetadata(RATE_LIMIT, bucket);

/**
 * Basic in-memory, fixed-window limiter (single instance, ADR 0001). Keyed by user, or by IP for anonymous requests.
 * Registered right after the session guard (AuthModule), so the user is known.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, { start: number; count: number }>();
  private lastSweep = Date.now();

  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bucket =
      this.reflector.get<RateLimitBucket | undefined>(RATE_LIMIT, context.getHandler()) ??
      (MUTATING.has(req.method) ? 'write' : undefined);
    if (!bucket) return true;

    const now = Date.now();
    this.sweep(now);
    const key = `${bucket}:${req.user?.id ?? `ip:${req.ip}`}`;
    const window = this.windows.get(key);
    if (!window || now - window.start >= WINDOW_MS) {
      this.windows.set(key, { start: now, count: 1 });
      return true;
    }
    window.count += 1;
    if (window.count <= this.limit(bucket)) return true;
    const retryAfter = Math.ceil((window.start + WINDOW_MS - now) / 1000);
    context.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retryAfter));
    throw apiError(429, 'rate_limited');
  }

  private limit(bucket: RateLimitBucket): number {
    switch (bucket) {
      case 'write':
        return this.config.RATE_LIMIT_WRITES_PER_MINUTE;
      case 'upload':
        return this.config.RATE_LIMIT_UPLOADS_PER_MINUTE;
      case 'search':
        return this.config.RATE_LIMIT_SEARCHES_PER_MINUTE;
    }
  }

  /** Drops expired windows once a minute, so memory stays bounded. */
  private sweep(now: number): void {
    if (now - this.lastSweep < WINDOW_MS) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) if (now - window.start >= WINDOW_MS) this.windows.delete(key);
  }
}
