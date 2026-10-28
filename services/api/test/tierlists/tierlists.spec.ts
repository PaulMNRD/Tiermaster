import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { addMember, createTierlist, newUser, roleFixture } from '../support/fixtures.js';

describe('tierlists', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp({ AUTH_FAKE_ENABLED: 'true' });
  });
  afterAll(() => t.close());

  describe('create and list (home)', () => {
    it('creates a tierlist owned by the creator, with default categories', async () => {
      const alice = await newUser(t, 'alice');
      const created = await createTierlist(t, alice, 'Fruits');
      expect(created).toMatchObject({ title: 'Fruits', role: 'OWNER', defaultRole: null, cardCount: 0 });
      expect(await t.prisma.category.count({ where: { tierlistId: created.id } })).toBe(5);
    });

    it('lists owned and shared tierlists with the role on each, never others', async () => {
      const alice = await newUser(t, 'alice');
      const bob = await newUser(t, 'bob');
      const own = await createTierlist(t, alice, 'Own');
      const shared = await createTierlist(t, bob, 'Shared with alice');
      await addMember(t, shared.id, alice, 'EDITOR');
      await createTierlist(t, bob, 'Bob private');
      await createTierlist(t, bob, 'Bob public', 'VIEWER');

      const res = await http().get('/api/tierlists').set('Cookie', alice.cookie).expect(200);
      const byId = Object.fromEntries(res.body.items.map((i: { id: string; role: string }) => [i.id, i.role]));
      expect(byId).toEqual({ [own.id]: 'OWNER', [shared.id]: 'EDITOR' });
    });

    it('searches and sorts', async () => {
      const carol = await newUser(t, 'carol');
      await createTierlist(t, carol, 'Banana breads');
      await createTierlist(t, carol, 'apple pies');
      await createTierlist(t, carol, 'Cherry jams');
      const sorted = await http().get('/api/tierlists?sort=title').set('Cookie', carol.cookie).expect(200);
      expect(sorted.body.items.map((i: { title: string }) => i.title)).toEqual(['apple pies', 'Banana breads', 'Cherry jams']);
      const searched = await http().get('/api/tierlists?q=BREAD').set('Cookie', carol.cookie).expect(200);
      expect(searched.body.items.map((i: { title: string }) => i.title)).toEqual(['Banana breads']);
    });

    describe('rejected', () => {
      it('requires a signed-in user', async () => {
        await http().get('/api/tierlists').expect(401);
        await http().post('/api/tierlists').send({ title: 'x' }).expect(401);
      });

      it('validates the payload', async () => {
        const alice = await newUser(t, 'alice');
        await http().post('/api/tierlists').set('Cookie', alice.cookie).send({ title: '  ' }).expect(400);
        await http().post('/api/tierlists').set('Cookie', alice.cookie).send({ title: 'x'.repeat(101) }).expect(400);
        await http().post('/api/tierlists').set('Cookie', alice.cookie).send({ title: 'x', defaultRole: 'OWNER' }).expect(400);
        await http().post('/api/tierlists').set('Cookie', alice.cookie).send({ title: 'x', extra: 1 }).expect(400);
      });
    });
  });

  describe('community', () => {
    it('lists public tierlists only, to anyone, with pagination and search', async () => {
      const dave = await newUser(t, 'dave');
      const tag = `zz${Date.now()}`;
      for (let i = 0; i < 5; i++) await createTierlist(t, dave, `${tag} public ${i}`, i % 2 ? 'EDITOR' : 'VIEWER');
      await createTierlist(t, dave, `${tag} private`);

      const page1 = await http().get(`/api/community?q=${tag}&pageSize=2&sort=title`).expect(200);
      expect(page1.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
      expect(page1.body.items.map((i: { title: string }) => i.title)).toEqual([`${tag} public 0`, `${tag} public 1`]);
      expect(page1.body.items[0].role).toBe('VIEWER');
      const page3 = await http().get(`/api/community?q=${tag}&pageSize=2&page=3&sort=title`).expect(200);
      expect(page3.body.items.map((i: { title: string }) => i.title)).toEqual([`${tag} public 4`]);
    });

    it('shows the effective role of a signed-in user', async () => {
      const erin = await newUser(t, 'erin');
      const tag = `yy${Date.now()}`;
      await createTierlist(t, erin, `${tag} editable`, 'EDITOR');
      const res = await http().get(`/api/community?q=${tag}`).set('Cookie', erin.cookie).expect(200);
      expect(res.body.items[0].role).toBe('OWNER');
      const anonymous = await http().get(`/api/community?q=${tag}`).expect(200);
      expect(anonymous.body.items[0].role).toBe('VIEWER');
    });

    it('rejects an invalid page', async () => {
      await http().get('/api/community?page=0').expect(400);
      await http().get('/api/community?pageSize=500').expect(400);
    });
  });

  describe('rename (EDITOR and above)', () => {
    it('lets owner, moderator, editor and a default EDITOR rename', async () => {
      const f = await roleFixture(t, 'EDITOR');
      for (const user of [f.owner, f.moderator, f.editor, f.stranger]) {
        const res = await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', user.cookie).send({ title: `By ${user.name}` }).expect(200);
        expect(res.body.title).toBe(`By ${user.name}`);
      }
    });

    describe('rejected', () => {
      it('403 for a viewer (even when defaultRole is EDITOR)', async () => {
        const f = await roleFixture(t, 'EDITOR');
        const res = await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.viewer.cookie).send({ title: 'x' }).expect(403);
        expect(res.body.code).toBe('forbidden');
      });

      it('404 for a signed-in stranger on a private tierlist (existence hidden)', async () => {
        const f = await roleFixture(t);
        await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.stranger.cookie).send({ title: 'x' }).expect(404);
      });

      it('401 for an anonymous visitor', async () => {
        const f = await roleFixture(t, 'EDITOR');
        await http().patch(`/api/tierlists/${f.tierlist.id}`).send({ title: 'x' }).expect(401);
      });

      it('404 for an unknown or malformed id', async () => {
        const alice = await newUser(t, 'alice');
        await http().patch(`/api/tierlists/${crypto.randomUUID()}`).set('Cookie', alice.cookie).send({ title: 'x' }).expect(404);
        await http().patch('/api/tierlists/not-a-uuid').set('Cookie', alice.cookie).send({ title: 'x' }).expect(404);
      });
    });
  });

  describe('default role (OWNER only)', () => {
    it('lets the owner make a tierlist public, then private', async () => {
      const f = await roleFixture(t);
      await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ defaultRole: 'VIEWER' }).expect(200);
      await http().get(`/api/community`).expect(200);
      const res = await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ defaultRole: null }).expect(200);
      expect(res.body.defaultRole).toBeNull();
    });

    it('rejected: moderator and editor get 403', async () => {
      const f = await roleFixture(t);
      for (const user of [f.moderator, f.editor]) {
        await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', user.cookie).send({ defaultRole: 'VIEWER' }).expect(403);
      }
      const unchanged = await t.prisma.tierlist.findUniqueOrThrow({ where: { id: f.tierlist.id } });
      expect(unchanged.defaultRole).toBeNull();
    });
  });

  describe('delete (OWNER only)', () => {
    it('deletes the tierlist and everything in it', async () => {
      const f = await roleFixture(t);
      await http().delete(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).expect(204);
      await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ title: 'x' }).expect(404);
      expect(await t.prisma.category.count({ where: { tierlistId: f.tierlist.id } })).toBe(0);
    });

    it('rejected: moderator 403, stranger 404, anonymous 401', async () => {
      const f = await roleFixture(t);
      await http().delete(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.moderator.cookie).expect(403);
      await http().delete(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.stranger.cookie).expect(404);
      await http().delete(`/api/tierlists/${f.tierlist.id}`).expect(401);
      expect(await t.prisma.tierlist.count({ where: { id: f.tierlist.id } })).toBe(1);
    });
  });

  it('records every write as an operation with an incremented rev', async () => {
    const f = await roleFixture(t, 'VIEWER');
    await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ title: 'One', clientOpId: 'op-1' }).expect(200);
    await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.editor.cookie).send({ title: 'Two' }).expect(200);
    const ops = await t.prisma.tierlistOp.findMany({ where: { tierlistId: f.tierlist.id }, orderBy: { rev: 'asc' } });
    expect(ops.map((op) => [op.rev, op.type, op.clientOpId, op.authorId])).toEqual([
      [1, 'tierlist.updated', 'op-1', f.owner.id],
      [2, 'tierlist.updated', null, f.editor.id],
    ]);
    const tierlist = await t.prisma.tierlist.findUniqueOrThrow({ where: { id: f.tierlist.id } });
    expect(tierlist.rev).toBe(2);
  });

  it('treats a retried clientOpId as the same operation (idempotent)', async () => {
    const f = await roleFixture(t);
    const first = await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ title: 'Once', clientOpId: 'retry-1' }).expect(200);
    const second = await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ title: 'Once', clientOpId: 'retry-1' }).expect(200);
    expect(second.body.rev).toBe(first.body.rev);
    expect(await t.prisma.tierlistOp.count({ where: { tierlistId: f.tierlist.id } })).toBe(1);
  });
});
