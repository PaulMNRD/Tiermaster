/** Shared helpers for authorization-code providers (Google, Discord). */

export async function exchangeCode(
  tokenUrl: string,
  params: { code: string; clientId: string; clientSecret: string; redirectUri: string },
): Promise<string> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('No access token');
  return body.access_token;
}

export async function fetchJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Profile request failed (${res.status})`);
  return (await res.json()) as T;
}
