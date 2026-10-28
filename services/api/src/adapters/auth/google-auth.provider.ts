import type { AuthProvider, OAuthProfile } from '../../ports/auth-provider.port.js';
import { exchangeCode, fetchJson } from './oauth2.js';

export class GoogleAuthProvider implements AuthProvider {
  readonly id = 'google' as const;

  constructor(private readonly clientId: string, private readonly clientSecret: string) {}

  authorizationUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    }).toString();
    return url.toString();
  }

  async handleCallback(query: Record<string, string>, redirectUri: string): Promise<OAuthProfile> {
    if (!query['code']) throw new Error('Missing code');
    const token = await exchangeCode('https://oauth2.googleapis.com/token', {
      code: query['code'],
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri,
    });
    const profile = await fetchJson<{ sub: string; email?: string; picture?: string }>(
      'https://openidconnect.googleapis.com/v1/userinfo',
      token,
    );
    return { providerUserId: profile.sub, email: profile.email ?? null, avatarUrl: profile.picture ?? null };
  }
}
