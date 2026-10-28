import type { AuthProvider, OAuthProfile } from '../../ports/auth-provider.port.js';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';

/**
 * Steam only offers OpenID 2.0: the callback carries `openid.*` parameters that are verified with
 * `check_authentication`. The state travels in the return URL. Steam provides no email.
 */
export class SteamAuthProvider implements AuthProvider {
  readonly id = 'steam' as const;

  constructor(private readonly apiKey: string) {}

  authorizationUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const returnTo = new URL(redirectUri);
    returnTo.searchParams.set('state', state);
    const url = new URL(STEAM_OPENID);
    url.search = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo.toString(),
      'openid.realm': returnTo.origin,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    }).toString();
    return url.toString();
  }

  async handleCallback(query: Record<string, string>): Promise<OAuthProfile> {
    const claimed = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/.exec(query['openid.claimed_id'] ?? '');
    if (!claimed) throw new Error('Invalid Steam identity');
    const params = new URLSearchParams(Object.entries(query).filter(([key]) => key.startsWith('openid.')));
    params.set('openid.mode', 'check_authentication');
    const res = await fetch(STEAM_OPENID, { method: 'POST', body: params });
    if (!(await res.text()).includes('is_valid:true')) throw new Error('Steam assertion rejected');

    const steamId = claimed[1]!;
    const summary = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${this.apiKey}&steamids=${steamId}`,
    );
    const body = (await summary.json().catch(() => null)) as { response?: { players?: { avatarfull?: string }[] } } | null;
    return { providerUserId: steamId, email: null, avatarUrl: body?.response?.players?.[0]?.avatarfull ?? null };
  }
}
