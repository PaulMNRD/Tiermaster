import request from 'supertest';
import type { TestApp } from './app.js';

export const SESSION_COOKIE = 'tm_session';

/** Extracts `name=value` pairs from Set-Cookie headers. */
export function cookiesFrom(res: request.Response): Record<string, string> {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookies: Record<string, string> = {};
  for (const line of raw ?? []) {
    const [pair] = line.split(';');
    const index = pair!.indexOf('=');
    cookies[pair!.slice(0, index)] = pair!.slice(index + 1);
  }
  return cookies;
}

/** Runs the fake OAuth flow and returns the raw session cookie header plus the final redirect. */
export async function fakeOAuthLogin(t: TestApp, loginHint: string, returnTo?: string) {
  const server = t.app.getHttpServer();
  const start = await request(server).get('/api/auth/fake').query({ loginHint, ...(returnTo ? { returnTo } : {}) }).expect(302);
  const oauthCookie = Object.entries(cookiesFrom(start)).map(([k, v]) => `${k}=${v}`).join('; ');
  const callback = new URL(start.headers.location!, 'http://localhost');
  const done = await request(server).get(callback.pathname + callback.search).set('Cookie', oauthCookie).expect(302);
  const session = cookiesFrom(done)[SESSION_COOKIE];
  return { cookie: session ? `${SESSION_COOKIE}=${session}` : '', location: done.headers.location! };
}

/** Logs in through the fake provider and picks the pseudonym; returns the cookie header and user id. */
export async function signUp(t: TestApp, name: string): Promise<{ cookie: string; id: string; name: string }> {
  const { cookie } = await fakeOAuthLogin(t, name.toLowerCase());
  const me = await request(t.app.getHttpServer()).get('/api/me').set('Cookie', cookie).expect(200);
  if (me.body.needsPseudonym) {
    await request(t.app.getHttpServer()).patch('/api/me').set('Cookie', cookie).send({ name }).expect(200);
  }
  return { cookie, id: me.body.id, name };
}
