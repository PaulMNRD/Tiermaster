import type { AuthProvider, OAuthProfile } from '../../ports/auth-provider.port.js';

/**
 * Development and test provider: skips the consent screen and signs in as the account named by `loginHint`.
 * Never enabled in production (the config refuses it).
 */
export class FakeAuthProvider implements AuthProvider {
  readonly id = 'fake' as const;

  authorizationUrl({ state, redirectUri, loginHint }: { state: string; redirectUri: string; loginHint?: string }): string {
    const url = new URL(redirectUri);
    url.searchParams.set('code', loginHint || 'demo');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async handleCallback(query: Record<string, string>): Promise<OAuthProfile> {
    const code = (query['code'] ?? '').toLowerCase();
    if (!/^[a-z0-9_.-]{1,32}$/.test(code)) throw new Error('Invalid fake login');
    return { providerUserId: code, email: `${code}@fake.test`, avatarUrl: null };
  }
}
