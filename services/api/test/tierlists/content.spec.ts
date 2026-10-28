import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { roleFixture, type TestUser } from '../support/fixtures.js';

describe('tierlist content (snapshot, categories, cards, ops)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const as = (user: TestUser | null) => ({
    get: (url: string) => (user ? http().get(url).set('Cookie', user.cookie) : http().get(url)),
    post: (url: string, body: object) => (user ? http().post(url).set('Cookie', user.cookie) : http().post(url)).send(body),
    patch: (url: string, body: object) => (user ? http().patch(url).set('Cookie', user.cookie) : http().patch(url)).send(body),
    delete: (url: string) => (user ? http().delete(url).set('Cookie', user.cookie) : http().delete(url)),
  });

  beforeAll(async () => {
    t = await createTestApp({ AUTH_FAKE_ENABLED: 'true' });
  });
  afterAll(() => t.close());

  describe('snapshot', () => {
    it('returns ordered categories and cards, rev and the effective role', async () => {
      const f = await roleFixture(t, 'VIEWER');
      const base = `/api/tierlists/${f.tierlist.id}`;
      await as(f.editor).post(`${base}/cards`, { title: 'Pool card' }).expect(201);
      const snap = await as(f.viewer).get(base).expect(200);
      expect(snap.body).toMatchObject({ id: f.tierlist.id, title: 'Fixture', rev: 1, effectiveRole: 'VIEWER' });
      expect(snap.body.categories.map((c: { name: string }) => c.name)).toEqual(['S', 'A', 'B', 'C', 'D']);
      expect(snap.body.cards).toHaveLength(1);
      expect(snap.body.cards[0]).toMatchObject({ title: 'Pool card', categoryId: null, imageKey: null });

      const anonymous = await as(null).get(base).expect(200);
      expect(anonymous.body.effectiveRole).toBe('VIEWER');
      const stranger = await as(f.stranger).get(base).expect(200);
      expect(stranger.body.effectiveRole).toBe('VIEWER');
    });

    describe('rejected', () => {
      it('401 anonymous and 404 stranger on a private tierlist', async () => {
        const f = await roleFixture(t);
        await as(null).get(`/api/tierlists/${f.tierlist.id}`).expect(401);
        await as(f.stranger).get(`/api/tierlists/${f.tierlist.id}`).expect(404);
        await as(f.viewer).get(`/api/tierlists/${f.tierlist.id}`).expect(200);
      });
    });
  });

  describe('cards', () => {
    it('creates, moves, edits and deletes a card (editor)', async () => {
      const f = await roleFixture(t);
      const base = `/api/tierlists/${f.tierlist.id}`;
      const snap0 = await as(f.editor).get(base).expect(200);
      const [s, a] = snap0.body.categories;

      const id = crypto.randomUUID();
      const created = await as(f.editor).post(`${base}/cards`, { id, title: 'Rust', categoryId: s.id, clientOpId: 'c1' }).expect(201);
      expect(created.body).toMatchObject({ rev: 1, card: { id, title: 'Rust', categoryId: s.id } });
      const second = await as(f.editor).post(`${base}/cards`, { title: 'Go', categoryId: s.id }).expect(201);
      const goId = second.body.card.id;
      // New cards go to the end of their list.
      expect(second.body.card.position > created.body.card.position).toBe(true);

      // Move "Go" before "Rust" (first of S), then to A.
      await as(f.editor).patch(`${base}/cards/${goId}/move`, { toCategoryId: s.id, afterCardId: null }).expect(200);
      let snap = await as(f.editor).get(base).expect(200);
      const inS = snap.body.cards.filter((c: { categoryId: string }) => c.categoryId === s.id).map((c: { title: string }) => c.title);
      expect(inS).toEqual(['Go', 'Rust']);
      await as(f.editor).patch(`${base}/cards/${goId}/move`, { toCategoryId: a.id, afterCardId: null }).expect(200);
      await as(f.editor).patch(`${base}/cards/${id}/move`, { toCategoryId: a.id, afterCardId: goId }).expect(200);
      snap = await as(f.editor).get(base).expect(200);
      expect(snap.body.cards.map((c: { title: string; categoryId: string }) => [c.title, c.categoryId])).toEqual([
        ['Go', a.id],
        ['Rust', a.id],
      ]);

      await as(f.editor).patch(`${base}/cards/${id}`, { title: 'Rust 2' }).expect(200);
      await as(f.editor).delete(`${base}/cards/${goId}`).expect(200);
      snap = await as(f.editor).get(base).expect(200);
      expect(snap.body.cards.map((c: { title: string }) => c.title)).toEqual(['Rust 2']);
      expect(snap.body.rev).toBe(7);
    });

    it('moves a card to the unsorted pool', async () => {
      const f = await roleFixture(t);
      const base = `/api/tierlists/${f.tierlist.id}`;
      const snap0 = await as(f.owner).get(base).expect(200);
      const card = await as(f.owner).post(`${base}/cards`, { title: 'x', categoryId: snap0.body.categories[0].id }).expect(201);
      await as(f.owner).patch(`${base}/cards/${card.body.card.id}/move`, { toCategoryId: null, afterCardId: null }).expect(200);
      const snap = await as(f.owner).get(base).expect(200);
      expect(snap.body.cards[0].categoryId).toBeNull();
    });

    describe('rejected', () => {
      it('403 for a viewer on every card write, nothing changes', async () => {
        const f = await roleFixture(t, 'EDITOR');
        const base = `/api/tierlists/${f.tierlist.id}`;
        const card = await as(f.editor).post(`${base}/cards`, { title: 'x' }).expect(201);
        const cardUrl = `${base}/cards/${card.body.card.id}`;
        await as(f.viewer).post(`${base}/cards`, { title: 'y' }).expect(403);
        await as(f.viewer).patch(cardUrl, { title: 'y' }).expect(403);
        await as(f.viewer).patch(`${cardUrl}/move`, { toCategoryId: null, afterCardId: null }).expect(403);
        await as(f.viewer).delete(cardUrl).expect(403);
        const snap = await as(f.owner).get(base).expect(200);
        expect(snap.body.rev).toBe(1);
      });

      it('401 anonymous and 404 stranger (private)', async () => {
        const f = await roleFixture(t);
        const base = `/api/tierlists/${f.tierlist.id}`;
        await as(null).post(`${base}/cards`, { title: 'y' }).expect(401);
        await as(f.stranger).post(`${base}/cards`, { title: 'y' }).expect(404);
      });

      it('404 for a card or category of another tierlist', async () => {
        const f = await roleFixture(t);
        const g = await roleFixture(t);
        const other = await as(g.owner).post(`/api/tierlists/${g.tierlist.id}/cards`, { title: 'other' }).expect(201);
        const otherCategory = (await as(g.owner).get(`/api/tierlists/${g.tierlist.id}`)).body.categories[0].id;
        const base = `/api/tierlists/${f.tierlist.id}`;
        await as(f.owner).patch(`${base}/cards/${other.body.card.id}`, { title: 'hijack' }).expect(404);
        await as(f.owner).delete(`${base}/cards/${other.body.card.id}`).expect(404);
        await as(f.owner).post(`${base}/cards`, { title: 'x', categoryId: otherCategory }).expect(404);
        await as(f.owner).patch(`${base}/cards/${other.body.card.id}/move`, { toCategoryId: null, afterCardId: null }).expect(404);
      });

      it('409 when the anchor card is not in the target list', async () => {
        const f = await roleFixture(t);
        const base = `/api/tierlists/${f.tierlist.id}`;
        const [s, a] = (await as(f.owner).get(base)).body.categories;
        const one = await as(f.owner).post(`${base}/cards`, { title: '1', categoryId: s.id }).expect(201);
        const two = await as(f.owner).post(`${base}/cards`, { title: '2', categoryId: s.id }).expect(201);
        const res = await as(f.owner).patch(`${base}/cards/${one.body.card.id}/move`, { toCategoryId: a.id, afterCardId: two.body.card.id }).expect(409);
        expect(res.body.code).toBe('stale_position');
      });

      it('400 on invalid payloads (title, image key of another tierlist)', async () => {
        const f = await roleFixture(t);
        const base = `/api/tierlists/${f.tierlist.id}`;
        await as(f.owner).post(`${base}/cards`, { title: '' }).expect(400);
        await as(f.owner).post(`${base}/cards`, { title: 'x'.repeat(81) }).expect(400);
        const foreignKey = `tierlists/${crypto.randomUUID()}/${crypto.randomUUID()}.webp`;
        const res = await as(f.owner).post(`${base}/cards`, { title: 'x', imageKey: foreignKey }).expect(400);
        expect(res.body.code).toBe('image_key_invalid');
      });
    });
  });

  describe('categories', () => {
    it('creates, renames, reorders and deletes categories; cards of a deleted category go to the pool', async () => {
      const f = await roleFixture(t);
      const base = `/api/tierlists/${f.tierlist.id}`;
      const [s, a] = (await as(f.editor).get(base)).body.categories;
      const created = await as(f.editor).post(`${base}/categories`, { name: 'S+', color: '#ff00ff', afterId: null }).expect(201);
      const sPlus = created.body.category.id;
      await as(f.editor).patch(`${base}/categories/${sPlus}`, { name: 'God tier' }).expect(200);
      await as(f.editor).patch(`${base}/categories/${s.id}/move`, { afterId: a.id }).expect(200);
      let snap = (await as(f.editor).get(base)).body;
      expect(snap.categories.map((c: { name: string }) => c.name)).toEqual(['God tier', 'A', 'S', 'B', 'C', 'D']);

      const pool = await as(f.editor).post(`${base}/cards`, { title: 'pool' }).expect(201);
      await as(f.editor).post(`${base}/cards`, { title: 'in S', categoryId: s.id }).expect(201);
      await as(f.editor).delete(`${base}/categories/${s.id}`).expect(200);
      snap = (await as(f.editor).get(base)).body;
      expect(snap.categories).toHaveLength(5);
      const poolCards = snap.cards.filter((c: { categoryId: null }) => c.categoryId === null).map((c: { title: string }) => c.title);
      expect(poolCards).toEqual(['pool', 'in S']);
      expect(pool.body.card.position < snap.cards.find((c: { title: string }) => c.title === 'in S').position).toBe(true);
    });

    describe('rejected', () => {
      it('403 for a viewer, 400 for an invalid color', async () => {
        const f = await roleFixture(t);
        const base = `/api/tierlists/${f.tierlist.id}`;
        const [s] = (await as(f.viewer).get(base)).body.categories;
        await as(f.viewer).post(`${base}/categories`, { name: 'x', color: '#000000' }).expect(403);
        await as(f.viewer).patch(`${base}/categories/${s.id}`, { name: 'x' }).expect(403);
        await as(f.viewer).patch(`${base}/categories/${s.id}/move`, { afterId: null }).expect(403);
        await as(f.viewer).delete(`${base}/categories/${s.id}`).expect(403);
        await as(f.owner).post(`${base}/categories`, { name: 'x', color: 'red' }).expect(400);
      });
    });
  });

  describe('ops since', () => {
    it('returns the missing ops in order', async () => {
      const f = await roleFixture(t, 'VIEWER');
      const base = `/api/tierlists/${f.tierlist.id}`;
      await as(f.owner).post(`${base}/cards`, { title: 'a', clientOpId: 'x1' }).expect(201);
      await as(f.owner).post(`${base}/cards`, { title: 'b' }).expect(201);
      await as(f.owner).patch(base, { title: 'Renamed' }).expect(200);
      const res = await as(null).get(`${base}/ops?since=1`).expect(200);
      expect(res.body.rev).toBe(3);
      expect(res.body.ops.map((op: { rev: number; type: string }) => [op.rev, op.type])).toEqual([
        [2, 'card.created'],
        [3, 'tierlist.updated'],
      ]);
      const all = await as(null).get(`${base}/ops?since=0`).expect(200);
      expect(all.body.ops[0]).toMatchObject({ rev: 1, clientOpId: 'x1', authorId: f.owner.id, tierlistId: f.tierlist.id });
    });

    it('410 when the gap is too large or the client is ahead', async () => {
      const f = await roleFixture(t);
      await t.prisma.tierlist.update({ where: { id: f.tierlist.id }, data: { rev: 5000 } });
      await as(f.owner).get(`/api/tierlists/${f.tierlist.id}/ops?since=1`).expect(410);
      await as(f.owner).get(`/api/tierlists/${f.tierlist.id}/ops?since=6000`).expect(410);
    });

    describe('rejected', () => {
      it('runs the read check: 404 for a stranger, 401 anonymous on private', async () => {
        const f = await roleFixture(t);
        await as(f.stranger).get(`/api/tierlists/${f.tierlist.id}/ops?since=0`).expect(404);
        await as(null).get(`/api/tierlists/${f.tierlist.id}/ops?since=0`).expect(401);
      });

      it('revoked mid-session: a removed member loses access to the snapshot and the ops', async () => {
        const f = await roleFixture(t);
        const base = `/api/tierlists/${f.tierlist.id}`;
        await as(f.viewer).get(base).expect(200);
        await t.prisma.membership.delete({ where: { userId_tierlistId: { userId: f.viewer.id, tierlistId: f.tierlist.id } } });
        await as(f.viewer).get(base).expect(404);
        await as(f.viewer).get(`${base}/ops?since=0`).expect(404);
      });

      it('demoted mid-session: an editor demoted to viewer can no longer write', async () => {
        const f = await roleFixture(t);
        const base = `/api/tierlists/${f.tierlist.id}`;
        await as(f.editor).post(`${base}/cards`, { title: 'ok' }).expect(201);
        await t.prisma.membership.update({
          where: { userId_tierlistId: { userId: f.editor.id, tierlistId: f.tierlist.id } },
          data: { role: 'VIEWER' },
        });
        await as(f.editor).post(`${base}/cards`, { title: 'nope' }).expect(403);
      });
    });
  });
});
