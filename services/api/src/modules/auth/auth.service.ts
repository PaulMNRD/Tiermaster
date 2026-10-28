import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AuthProviderId } from '@tiermaster/shared';
import { notFound } from '../../common/errors.js';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { AUTH_PROVIDERS, type AuthProvider } from '../../ports/auth-provider.port.js';
import { UsersService } from '../users/users.service.js';
import { SessionService } from './session.service.js';

export const SESSION_TTL_SECONDS = 30 * 24 * 3600;
export const SOCKET_TOKEN_TTL_SECONDS = 5 * 60;
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

interface OAuthState {
  state: string;
  provider: string;
  returnTo: string;
}

/** Only same-origin relative paths are accepted as return targets (no open redirect). */
export function safeReturnTo(value: unknown): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/';
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDERS) private readonly providers: AuthProvider[],
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

  enabledProviders(): AuthProviderId[] {
    return this.providers.map((p) => p.id);
  }

  /** Builds the provider redirect and the signed state cookie value. */
  start(providerId: string, returnTo: unknown, loginHint?: string): { url: string; stateCookie: string } {
    const provider = this.provider(providerId);
    const state = randomBytes(16).toString('base64url');
    const payload: OAuthState = { state, provider: provider.id, returnTo: safeReturnTo(returnTo) };
    const stateCookie = this.sessions.issue(JSON.stringify(payload), 'oauth', OAUTH_STATE_TTL_SECONDS);
    const url = provider.authorizationUrl({ state, redirectUri: this.callbackUrl(provider.id), loginHint });
    return { url, stateCookie };
  }

  /** Verifies the state, resolves the profile and returns the session token and where to go next. */
  async finish(
    providerId: string,
    query: Record<string, string>,
    stateCookie: string | undefined,
  ): Promise<{ sessionToken: string; redirect: string } | { error: string }> {
    const provider = this.provider(providerId);
    const raw = this.sessions.verify(stateCookie, 'oauth');
    const saved = raw ? (JSON.parse(raw) as OAuthState) : null;
    if (!saved || saved.provider !== provider.id || saved.state !== query['state']) return { error: 'oauth_state' };

    let profile;
    try {
      profile = await provider.handleCallback(query, this.callbackUrl(provider.id));
    } catch {
      return { error: 'oauth_failed' };
    }
    const user = await this.users.signInWithOAuth(provider.id, profile);
    const redirect = user.name === null ? `/welcome?returnTo=${encodeURIComponent(saved.returnTo)}` : saved.returnTo;
    return { sessionToken: this.sessions.issue(user.id, 'session', SESSION_TTL_SECONDS), redirect };
  }

  socketToken(userId: string): string {
    return this.sessions.issue(userId, 'socket', SOCKET_TOKEN_TTL_SECONDS);
  }

  publicUrl(path: string): string {
    return new URL(path, this.config.PUBLIC_URL).toString();
  }

  private provider(id: string): AuthProvider {
    const provider = this.providers.find((p) => p.id === id);
    if (!provider) throw notFound();
    return provider;
  }

  private callbackUrl(providerId: string): string {
    return this.publicUrl(`/api/auth/${providerId}/callback`);
  }
}
