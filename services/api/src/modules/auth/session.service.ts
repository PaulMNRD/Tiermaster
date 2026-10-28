import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';

export type TokenKind = 'session' | 'socket' | 'oauth';

interface TokenPayload {
  sub: string;
  kind: TokenKind;
  exp: number;
}

/**
 * Stateless signed tokens (HMAC-SHA256): `base64url(payload).base64url(signature)`.
 * The session cookie, the Socket.IO handshake token and the OAuth state cookie all use them, each with its own kind.
 */
@Injectable()
export class SessionService {
  constructor(@Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'SESSION_SECRET'>) {}

  issue(subject: string, kind: TokenKind, ttlSeconds: number): string {
    const payload: TokenPayload = { sub: subject, kind, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  /** Returns the subject, or null when the token is malformed, forged, expired or of another kind. */
  verify(token: string | undefined, kind: TokenKind): string | null {
    const [encoded, signature, extra] = (token ?? '').split('.');
    if (!encoded || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.sign(encoded));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as TokenPayload;
      if (payload.kind !== kind || typeof payload.sub !== 'string') return null;
      if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
      return payload.sub;
    } catch {
      return null;
    }
  }

  private sign(data: string): string {
    return createHmac('sha256', this.config.SESSION_SECRET).update(data).digest('base64url');
  }
}
