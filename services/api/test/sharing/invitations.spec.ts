import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { newUser, roleFixture, type TestUser } from '../support/fixtures.js';
import { connect, type TestSocket } from '../support/sockets.js';

describe('invitations', () => {
  let t: TestApp;
  const sockets: TestSocket[] = [];
  const http = () => request(t.app.getHttpServer());
  const invite = (actor: TestUser, tierlistId: string, body: object) =>
    http().post(`/api/tierlists/${tierlistId}/invitations`).set('Cookie', actor.cookie).send(body);
  const tokenOf = (url: string) => url.split('/join/')[1]!;
  const roleOf = async (tierlistId: string, user: TestUser) =>
    (await t.prisma.membership.findUnique({ where: { userId_tierlistId: { userId: user.id, tierlistId } } }))?.role ?? null;

  beforeAll(async () => {
    t = await createTestApp({ AUTH_FAKE_ENABLED: 'true' });
  });
  afterEach(() => {
    for (const s of sockets.splice(0)) s.close();
  });
  afterAll(() => t.close());

  describe('links', () => {
    it('a moderator creates a link; anyone holding it can preview and accept', async () => {
      const f = await roleFixture(t);
      const res = await invite(f.moderator, f.tierlist.id, { role: 'EDITOR' }).expect(201);
      expect(res.body.url).toMatch(/^http:\/\/localhost:4200\/join\/[A-Za-z0-9_-]{43}$/);
      expect(res.body.invitation).toMatchObject({ kind: 'link', role: 'EDITOR', invitee: null });
      const token = tokenOf(res.body.url);

      const preview = await http().get(`/api/invitations/${token}`).expect(200);
      expect(preview.body).toMatchObject({ tierlistId: f.tierlist.id, tierlistTitle: 'Fixture', role: 'EDITOR', invitedBy: f.moderator.name });

      // Only the hash is stored.
      const stored = await t.prisma.invitation.findFirstOrThrow({ where: { tierlistId: f.tierlist.id } });
      expect(stored.tokenHash).not.toBe(token);
      expect(stored.tokenHash).toHaveLength(64);

      const accepted = await http().post(`/api/invitations/${token}/accept`).set('Cookie', f.stranger.cookie).expect(200);
      expect(accepted.body).toEqual({ tierlistId: f.tierlist.id, role: 'EDITOR', changed: true });
      expect(await roleOf(f.tierlist.id, f.stranger)).toBe('EDITOR');

      const other = await newUser(t, 'guest');
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', other.cookie).expect(200);
      expect(await roleOf(f.tierlist.id, other)).toBe('EDITOR');
    });

    it('accepting never lowers a role (membership or defaultRole)', async () => {
      const f = await roleFixture(t, 'EDITOR');
      const { body } = await invite(f.owner, f.tierlist.id, { role: 'VIEWER' }).expect(201);
      const token = tokenOf(body.url);
      const mod = await http().post(`/api/invitations/${token}/accept`).set('Cookie', f.moderator.cookie).expect(200);
      expect(mod.body).toEqual({ tierlistId: f.tierlist.id, role: 'MODERATOR', changed: false });
      const stranger = await http().post(`/api/invitations/${token}/accept`).set('Cookie', f.stranger.cookie).expect(200);
      expect(stranger.body).toEqual({ tierlistId: f.tierlist.id, role: 'EDITOR', changed: false });
      expect(await roleOf(f.tierlist.id, f.stranger)).toBeNull();
      const owner = await http().post(`/api/invitations/${token}/accept`).set('Cookie', f.owner.cookie).expect(200);
      expect(owner.body.role).toBe('OWNER');
    });

    it('accepting raises the role of an existing member', async () => {
      const f = await roleFixture(t);
      const { body } = await invite(f.owner, f.tierlist.id, { role: 'MODERATOR' }).expect(201);
      await http().post(`/api/invitations/${tokenOf(body.url)}/accept`).set('Cookie', f.viewer.cookie).expect(200);
      expect(await roleOf(f.tierlist.id, f.viewer)).toBe('MODERATOR');
    });

    describe('rejected', () => {
      it('a moderator cannot create a MODERATOR link; editors cannot invite', async () => {
        const f = await roleFixture(t);
        await invite(f.moderator, f.tierlist.id, { role: 'MODERATOR' }).expect(403);
        await invite(f.editor, f.tierlist.id, { role: 'VIEWER' }).expect(403);
        await invite(f.stranger, f.tierlist.id, { role: 'VIEWER' }).expect(404);
      });

      it('expired, revoked or unknown links are refused', async () => {
        const f = await roleFixture(t);
        const expired = await invite(f.owner, f.tierlist.id, { role: 'VIEWER' }).expect(201);
        await t.prisma.invitation.update({ where: { id: expired.body.invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        await http().get(`/api/invitations/${tokenOf(expired.body.url)}`).expect(404);
        await http().post(`/api/invitations/${tokenOf(expired.body.url)}/accept`).set('Cookie', f.stranger.cookie).expect(404);

        const revoked = await invite(f.owner, f.tierlist.id, { role: 'VIEWER' }).expect(201);
        await http().delete(`/api/tierlists/${f.tierlist.id}/invitations/${revoked.body.invitation.id}`).set('Cookie', f.owner.cookie).expect(204);
        await http().post(`/api/invitations/${tokenOf(revoked.body.url)}/accept`).set('Cookie', f.stranger.cookie).expect(404);

        await http().get(`/api/invitations/${'x'.repeat(43)}`).expect(404);
        expect(await roleOf(f.tierlist.id, f.stranger)).toBeNull();
      });

      it('accepting requires a signed-in user', async () => {
        const f = await roleFixture(t);
        const { body } = await invite(f.owner, f.tierlist.id, { role: 'VIEWER' }).expect(201);
        await http().post(`/api/invitations/${tokenOf(body.url)}/accept`).expect(401);
      });
    });
  });

  describe('by pseudonym (accept or decline)', () => {
    it('the invitee is notified, sees the invitation on the home page and accepts it', async () => {
      const f = await roleFixture(t);
      const socket = await connect(t, f.stranger);
      sockets.push(socket);
      const res = await invite(f.moderator, f.tierlist.id, { role: 'EDITOR', inviteeId: f.stranger.id }).expect(201);
      expect(res.body.url).toBeNull();
      expect(res.body.invitation).toMatchObject({ kind: 'user', invitee: { id: f.stranger.id, name: f.stranger.name } });
      expect(await socket.next('notification')).toEqual({ type: 'invitations.changed' });

      const mine = await http().get('/api/me/invitations').set('Cookie', f.stranger.cookie).expect(200);
      expect(mine.body.invitations).toHaveLength(1);
      expect(mine.body.invitations[0]).toMatchObject({ tierlist: { id: f.tierlist.id, title: 'Fixture' }, role: 'EDITOR', invitedBy: f.moderator.name });

      const accepted = await http().post(`/api/me/invitations/${mine.body.invitations[0].id}/accept`).set('Cookie', f.stranger.cookie).expect(200);
      expect(accepted.body).toEqual({ tierlistId: f.tierlist.id, role: 'EDITOR', changed: true });
      expect(await roleOf(f.tierlist.id, f.stranger)).toBe('EDITOR');
      expect((await http().get('/api/me/invitations').set('Cookie', f.stranger.cookie)).body.invitations).toEqual([]);
      const home = await http().get('/api/tierlists').set('Cookie', f.stranger.cookie).expect(200);
      expect(home.body.items.map((i: { id: string }) => i.id)).toContain(f.tierlist.id);
    });

    it('the invitee declines', async () => {
      const f = await roleFixture(t);
      await invite(f.owner, f.tierlist.id, { role: 'VIEWER', inviteeId: f.stranger.id }).expect(201);
      const mine = await http().get('/api/me/invitations').set('Cookie', f.stranger.cookie).expect(200);
      await http().post(`/api/me/invitations/${mine.body.invitations[0].id}/decline`).set('Cookie', f.stranger.cookie).expect(204);
      expect(await roleOf(f.tierlist.id, f.stranger)).toBeNull();
      expect(await t.prisma.invitation.count({ where: { tierlistId: f.tierlist.id } })).toBe(0);
    });

    describe('rejected', () => {
      it('409 when the invitee already has an equal or higher role; 403 for the owner; 404 for unknown users', async () => {
        const f = await roleFixture(t, 'VIEWER');
        const res = await invite(f.owner, f.tierlist.id, { role: 'VIEWER', inviteeId: f.editor.id }).expect(409);
        expect(res.body.code).toBe('already_has_access');
        await invite(f.owner, f.tierlist.id, { role: 'VIEWER', inviteeId: f.stranger.id }).expect(409);
        await invite(f.moderator, f.tierlist.id, { role: 'VIEWER', inviteeId: f.owner.id }).expect(403);
        await invite(f.owner, f.tierlist.id, { role: 'VIEWER', inviteeId: crypto.randomUUID() }).expect(404);
      });

      it('a moderator cannot invite as moderator, nor re-invite another moderator', async () => {
        const f = await roleFixture(t);
        await invite(f.moderator, f.tierlist.id, { role: 'MODERATOR', inviteeId: f.stranger.id }).expect(403);
        const other = await newUser(t, 'mod');
        await t.prisma.membership.create({ data: { tierlistId: f.tierlist.id, userId: other.id, role: 'MODERATOR' } });
        await invite(f.moderator, f.tierlist.id, { role: 'EDITOR', inviteeId: other.id }).expect(403);
      });

      it("one user cannot accept or decline another user's invitation", async () => {
        const f = await roleFixture(t);
        await invite(f.owner, f.tierlist.id, { role: 'EDITOR', inviteeId: f.stranger.id }).expect(201);
        const id = (await t.prisma.invitation.findFirstOrThrow({ where: { tierlistId: f.tierlist.id } })).id;
        await http().post(`/api/me/invitations/${id}/accept`).set('Cookie', f.viewer.cookie).expect(404);
        await http().post(`/api/me/invitations/${id}/decline`).set('Cookie', f.viewer.cookie).expect(404);
        expect(await roleOf(f.tierlist.id, f.viewer)).toBe('VIEWER');
      });
    });
  });

  describe('management', () => {
    it('the owner sees every pending invitation; a moderator only those it could assign or created', async () => {
      const f = await roleFixture(t);
      await invite(f.owner, f.tierlist.id, { role: 'MODERATOR' }).expect(201);
      await invite(f.owner, f.tierlist.id, { role: 'VIEWER' }).expect(201);
      await invite(f.moderator, f.tierlist.id, { role: 'EDITOR' }).expect(201);
      const owner = await http().get(`/api/tierlists/${f.tierlist.id}/invitations`).set('Cookie', f.owner.cookie).expect(200);
      expect(owner.body.invitations).toHaveLength(3);
      const moderator = await http().get(`/api/tierlists/${f.tierlist.id}/invitations`).set('Cookie', f.moderator.cookie).expect(200);
      expect(moderator.body.invitations.map((i: { role: string }) => i.role).sort()).toEqual(['EDITOR', 'VIEWER']);
      await http().get(`/api/tierlists/${f.tierlist.id}/invitations`).set('Cookie', f.editor.cookie).expect(403);
    });

    it('rejected: a moderator cannot revoke an owner-created MODERATOR invitation', async () => {
      const f = await roleFixture(t);
      const { body } = await invite(f.owner, f.tierlist.id, { role: 'MODERATOR' }).expect(201);
      await http().delete(`/api/tierlists/${f.tierlist.id}/invitations/${body.invitation.id}`).set('Cookie', f.moderator.cookie).expect(404);
    });
  });
});
