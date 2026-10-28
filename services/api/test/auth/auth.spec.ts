import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { cookiesFrom, fakeOAuthLogin, SESSION_COOKIE, signUp } from '../support/auth.js';

describe('authentication', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp({ AUTH_FAKE_ENABLED: 'true' });
  });
  afterAll(() => t.close());

  it('lists the enabled providers', async () => {
    const res = await http().get('/api/auth/providers').expect(200);
    expect(res.body.providers).toEqual(['fake']);
  });

  it('creates an account on first login and asks for a pseudonym', async () => {
    const { cookie, location } = await fakeOAuthLogin(t, 'newcomer');
    expect(cookie).toContain(SESSION_COOKIE);
    expect(location).toBe('http://localhost:4200/welcome?returnTo=%2F');
    const me = await http().get('/api/me').set('Cookie', cookie).expect(200);
    expect(me.body).toMatchObject({ name: null, needsPseudonym: true, email: 'newcomer@fake.test' });
  });

  it('sets a pseudonym, then logs back into the same account', async () => {
    const first = await signUp(t, 'Returning');
    const again = await fakeOAuthLogin(t, 'returning', '/join/abc');
    expect(again.location).toBe('http://localhost:4200/join/abc');
    const me = await http().get('/api/me').set('Cookie', again.cookie).expect(200);
    expect(me.body).toMatchObject({ id: first.id, name: 'Returning', needsPseudonym: false });
  });

  it('sends the session cookie httpOnly and SameSite=Lax', async () => {
    const start = await http().get('/api/auth/fake').query({ loginHint: 'cookieflags' }).expect(302);
    const callback = new URL(start.headers.location!, 'http://localhost');
    const oauth = Object.entries(cookiesFrom(start)).map(([k, v]) => `${k}=${v}`).join('; ');
    const done = await http().get(callback.pathname + callback.search).set('Cookie', oauth).expect(302);
    const line = (done.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(SESSION_COOKIE))!;
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
  });

  describe('rejected', () => {
    it('rejects a callback whose state does not match', async () => {
      const start = await http().get('/api/auth/fake').query({ loginHint: 'mallory' }).expect(302);
      const oauth = Object.entries(cookiesFrom(start)).map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await http().get('/api/auth/fake/callback?code=mallory&state=forged').set('Cookie', oauth).expect(302);
      expect(res.headers.location).toBe('http://localhost:4200/login?error=oauth_state');
      expect(cookiesFrom(res)[SESSION_COOKIE] ?? '').toBe('');
    });

    it('rejects a callback without the state cookie', async () => {
      const res = await http().get('/api/auth/fake/callback?code=mallory&state=x').expect(302);
      expect(res.headers.location).toBe('http://localhost:4200/login?error=oauth_state');
    });

    it('rejects an unknown or disabled provider', async () => {
      await http().get('/api/auth/google').expect(404);
      await http().get('/api/auth/nope').expect(404);
    });

    it('ignores an absolute returnTo (open redirect)', async () => {
      const { location } = await fakeOAuthLogin(t, 'redirector', 'https://evil.example/x');
      expect(location).toBe('http://localhost:4200/welcome?returnTo=%2F');
      const again = await fakeOAuthLogin(t, 'redirector', '//evil.example');
      expect(again.location.startsWith('http://localhost:4200/')).toBe(true);
    });

    it('returns 401 on /api/me without a session or with a tampered one', async () => {
      await http().get('/api/me').expect(401);
      const { cookie } = await signUp(t, 'Tamper');
      await http().get('/api/me').set('Cookie', cookie.slice(0, -2) + 'xx').expect(401);
    });

    it('validates the pseudonym and keeps it unique (case-insensitive)', async () => {
      await signUp(t, 'Unique');
      const { cookie } = await fakeOAuthLogin(t, 'other-unique');
      await http().patch('/api/me').set('Cookie', cookie).send({ name: 'x' }).expect(400);
      await http().patch('/api/me').set('Cookie', cookie).send({ name: 'bad name!' }).expect(400);
      const res = await http().patch('/api/me').set('Cookie', cookie).send({ name: 'UNIQUE' }).expect(409);
      expect(res.body.code).toBe('pseudonym_taken');
    });

    it('requires a pseudonym before using the application', async () => {
      const { cookie } = await fakeOAuthLogin(t, 'nopseudo');
      const res = await http().get('/api/auth/socket-token').set('Cookie', cookie).expect(403);
      expect(res.body.code).toBe('pseudonym_required');
    });
  });

  it('logs out by clearing the session cookie', async () => {
    const { cookie } = await signUp(t, 'Leaver');
    const res = await http().post('/api/auth/logout').set('Cookie', cookie).expect(204);
    expect(cookiesFrom(res)[SESSION_COOKIE]).toBe('');
  });

  it('issues a short-lived socket token to a signed-in user', async () => {
    await http().get('/api/auth/socket-token').expect(401);
    const { cookie } = await signUp(t, 'Socketeer');
    const res = await http().get('/api/auth/socket-token').set('Cookie', cookie).expect(200);
    expect(typeof res.body.token).toBe('string');
  });
});

describe('authentication without the fake provider', () => {
  it('does not expose the fake provider', async () => {
    const t = await createTestApp();
    try {
      const res = await request(t.app.getHttpServer()).get('/api/auth/providers').expect(200);
      expect(res.body.providers).toEqual([]);
      await request(t.app.getHttpServer()).get('/api/auth/fake').expect(404);
    } finally {
      await t.close();
    }
  });
});
