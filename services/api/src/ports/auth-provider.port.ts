import type { AuthProviderId } from '@tiermaster/shared';

/** Identity returned by a provider after a successful sign-in. */
export interface OAuthProfile {
  providerUserId: string;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * Port for identity providers (ADR 0002). OAuth adapters now; email/password can be added later without
 * changes outside the auth module.
 */
export interface AuthProvider {
  readonly id: AuthProviderId;
  /** URL the browser is redirected to; the provider calls `redirectUri` back with the given `state`. */
  authorizationUrl(params: { state: string; redirectUri: string; loginHint?: string }): string;
  /** Turns the callback query into a profile. Must throw when the callback is invalid. */
  handleCallback(query: Record<string, string>, redirectUri: string): Promise<OAuthProfile>;
}

export const AUTH_PROVIDERS = Symbol('AUTH_PROVIDERS');
