import type { AuthProvider, OAuthProfile } from '../../ports/auth-provider.port.js';
import { exchangeCode, fetchJson } from './oauth2.js';

export class DiscordAuthProvider implements AuthProvider {
  readonly id = 'discord' as const;

  constructor(private readonly clientId: string, private readonly clientSecret: string) {}

  authorizationUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify email',
      state,
    }).toString();
    return url.toString();
  }

  async handleCallback(query: Record<string, string>, redirectUri: string): Promise<OAuthProfile> {
    if (!query['code']) throw new Error('Missing code');
    const token = await exchangeCode('https://discord.com/api/oauth2/token', {
      code: query['code'],
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri,
    });
    const user = await fetchJson<{ id: string; email?: string | null; avatar?: string | null }>(
      'https://discord.com/api/users/@me',
      token,
    );
    const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;
    return { providerUserId: user.id, email: user.email ?? null, avatarUrl };
  }
}
