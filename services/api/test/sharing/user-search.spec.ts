import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { newUser, roleFixture } from '../support/fixtures.js';

describe('GET /api/users/search', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp({ AUTH_FAKE_ENABLED: 'true' });
  });
  afterAll(() => t.close());

  it('finds users by pseudonym (case-insensitive, partial), never exposing emails', async () => {
    const me = await newUser(t, 'searcher');
    const target = await newUser(t, 'Zephyrine');
    const res = await http().get('/api/users/search?q=PHYRI').set('Cookie', me.cookie).expect(200);
    expect(res.body.users).toEqual([{ id: target.id, name: target.name, avatarUrl: null }]);
    const byEmail = await http().get('/api/users/search?q=fake.test').set('Cookie', me.cookie).expect(200);
    expect(byEmail.body.users).toEqual([]);
  });

  it('excludes the owner and members when excludeMembersOf is given', async () => {
    const f = await roleFixture(t);
    const res = await http().get(`/api/users/search?q=r&excludeMembersOf=${f.tierlist.id}`).set('Cookie', f.owner.cookie);
    expect(res.status).toBe(400);
    const all = await http().get(`/api/users/search?q=er&excludeMembersOf=${f.tierlist.id}`).set('Cookie', f.owner.cookie).expect(200);
    const names = all.body.users.map((u: { name: string }) => u.name);
    for (const member of [f.owner, f.moderator, f.editor, f.viewer]) expect(names).not.toContain(member.name);
    expect(names).toContain(f.stranger.name);
  });

  it('caps the number of results', async () => {
    const me = await newUser(t, 'capper');
    for (let i = 0; i < 12; i++) await newUser(t, 'capped');
    const res = await http().get('/api/users/search?q=capped').set('Cookie', me.cookie).expect(200);
    expect(res.body.users).toHaveLength(10);
  });

  describe('rejected', () => {
    it('requires a signed-in user and at least 2 characters', async () => {
      await http().get('/api/users/search?q=ab').expect(401);
      const me = await newUser(t, 'short');
      await http().get('/api/users/search?q=a').set('Cookie', me.cookie).expect(400);
    });

    it('excludeMembersOf turns into 404 for users who cannot invite', async () => {
      const f = await roleFixture(t);
      await http().get(`/api/users/search?q=st&excludeMembersOf=${f.tierlist.id}`).set('Cookie', f.editor.cookie).expect(404);
      await http().get(`/api/users/search?q=st&excludeMembersOf=${f.tierlist.id}`).set('Cookie', f.stranger.cookie).expect(404);
    });
  });
});
