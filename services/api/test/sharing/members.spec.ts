import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { roleFixture, type TestUser } from '../support/fixtures.js';
import { connect, expectSilence, type TestSocket } from '../support/sockets.js';

describe('members', () => {
  let t: TestApp;
  const sockets: TestSocket[] = [];
  const http = () => request(t.app.getHttpServer());
  const patchRole = (actor: TestUser, tierlistId: string, target: TestUser, role: string) =>
    http().patch(`/api/tierlists/${tierlistId}/members/${target.id}`).set('Cookie', actor.cookie).send({ role });
  const remove = (actor: TestUser, tierlistId: string, target: TestUser) =>
    http().delete(`/api/tierlists/${tierlistId}/members/${target.id}`).set('Cookie', actor.cookie);
  const roleOf = async (tierlistId: string, user: TestUser) =>
    (await t.prisma.membership.findUnique({ where: { userId_tierlistId: { userId: user.id, tierlistId } } }))?.role ?? null;
  const open = async (user: TestUser | null) => {
    const client = await connect(t, user);
    sockets.push(client);
    return client;
  };

  beforeAll(async () => {
    t = await createTestApp({ AUTH_FAKE_ENABLED: 'true' });
  });
  afterEach(() => {
    for (const s of sockets.splice(0)) s.close();
  });
  afterAll(() => t.close());

  it('lists the owner and members to anyone who can read', async () => {
    const f = await roleFixture(t);
    const res = await http().get(`/api/tierlists/${f.tierlist.id}/members`).set('Cookie', f.viewer.cookie).expect(200);
    expect(res.body.members.map((m: { user: { name: string }; role: string }) => [m.user.name, m.role])).toEqual([
      [f.owner.name, 'OWNER'],
      [f.moderator.name, 'MODERATOR'],
      [f.editor.name, 'EDITOR'],
      [f.viewer.name, 'VIEWER'],
    ]);
    expect(JSON.stringify(res.body)).not.toContain('@');
  });

  it('owner promotes to and demotes from moderator', async () => {
    const f = await roleFixture(t);
    await patchRole(f.owner, f.tierlist.id, f.editor, 'MODERATOR').expect(200);
    expect(await roleOf(f.tierlist.id, f.editor)).toBe('MODERATOR');
    await patchRole(f.owner, f.tierlist.id, f.moderator, 'VIEWER').expect(200);
    expect(await roleOf(f.tierlist.id, f.moderator)).toBe('VIEWER');
  });

  it('moderator changes and removes editors and viewers', async () => {
    const f = await roleFixture(t);
    await patchRole(f.moderator, f.tierlist.id, f.editor, 'VIEWER').expect(200);
    await patchRole(f.moderator, f.tierlist.id, f.viewer, 'EDITOR').expect(200);
    await remove(f.moderator, f.tierlist.id, f.editor).expect(204);
    expect(await roleOf(f.tierlist.id, f.editor)).toBeNull();
  });

  it('logs member changes as operations', async () => {
    const f = await roleFixture(t);
    await patchRole(f.owner, f.tierlist.id, f.viewer, 'EDITOR').expect(200);
    await remove(f.owner, f.tierlist.id, f.viewer).expect(204);
    const ops = await t.prisma.tierlistOp.findMany({ where: { tierlistId: f.tierlist.id }, orderBy: { rev: 'asc' } });
    expect(ops.map((op) => op.type)).toEqual(['member.updated', 'member.removed']);
  });

  describe('rejected', () => {
    it('moderator cannot grant, change or remove a moderator, nor touch the owner', async () => {
      const f = await roleFixture(t);
      await patchRole(f.moderator, f.tierlist.id, f.editor, 'MODERATOR').expect(403);
      await patchRole(f.moderator, f.tierlist.id, f.moderator, 'EDITOR').expect(403);
      await remove(f.moderator, f.tierlist.id, f.moderator).expect(403);
      await remove(f.moderator, f.tierlist.id, f.owner).expect(403);
      expect(await roleOf(f.tierlist.id, f.editor)).toBe('EDITOR');
    });

    it('editors and viewers cannot manage members; strangers get 404', async () => {
      const f = await roleFixture(t);
      await patchRole(f.editor, f.tierlist.id, f.viewer, 'EDITOR').expect(403);
      await remove(f.viewer, f.tierlist.id, f.editor).expect(403);
      await patchRole(f.stranger, f.tierlist.id, f.viewer, 'EDITOR').expect(404);
      await http().get(`/api/tierlists/${f.tierlist.id}/members`).set('Cookie', f.stranger.cookie).expect(404);
    });

    it('the owner cannot be a target, and OWNER is not assignable', async () => {
      const f = await roleFixture(t);
      await patchRole(f.owner, f.tierlist.id, f.owner, 'VIEWER').expect(403);
      await patchRole(f.owner, f.tierlist.id, f.editor, 'OWNER').expect(400);
    });

    it('404 for a user who is not a member', async () => {
      const f = await roleFixture(t);
      await patchRole(f.owner, f.tierlist.id, f.stranger, 'VIEWER').expect(404);
      await remove(f.owner, f.tierlist.id, f.stranger).expect(404);
    });
  });

  describe('leave', () => {
    it('a member leaves; afterwards the private tierlist is hidden', async () => {
      const f = await roleFixture(t);
      await http().post(`/api/tierlists/${f.tierlist.id}/leave`).set('Cookie', f.moderator.cookie).expect(204);
      await http().get(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.moderator.cookie).expect(404);
    });

    it('rejected: the owner cannot leave; a non-member gets 404', async () => {
      const f = await roleFixture(t, 'VIEWER');
      await http().post(`/api/tierlists/${f.tierlist.id}/leave`).set('Cookie', f.owner.cookie).expect(403);
      await http().post(`/api/tierlists/${f.tierlist.id}/leave`).set('Cookie', f.stranger.cookie).expect(404);
    });
  });

  it("revokes the pending invitations of a moderator who is demoted", async () => {
    const f = await roleFixture(t);
    await http().post(`/api/tierlists/${f.tierlist.id}/invitations`).set('Cookie', f.moderator.cookie).send({ role: 'VIEWER' }).expect(201);
    await patchRole(f.owner, f.tierlist.id, f.moderator, 'EDITOR').expect(200);
    const invitation = await t.prisma.invitation.findFirstOrThrow({ where: { tierlistId: f.tierlist.id } });
    expect(invitation.revokedAt).not.toBeNull();
  });

  describe('revoked mid-session (live)', () => {
    it('a removed member of a private tierlist is evicted from the room', async () => {
      const f = await roleFixture(t);
      const viewer = await open(f.viewer);
      const editor = await open(f.editor);
      await viewer.join(f.tierlist.id);
      await editor.join(f.tierlist.id);
      await remove(f.owner, f.tierlist.id, f.viewer).expect(204);
      expect(await viewer.next('access.revoked')).toEqual({ tierlistId: f.tierlist.id, reason: 'revoked' });
      // Others see the change in the member list and are not evicted.
      expect(await editor.next('event')).toMatchObject({ type: 'member.removed', payload: { userId: f.viewer.id } });
      await expectSilence(editor, 'access.revoked');
      // No further event reaches the removed member.
      viewer.received.clear();
      await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.owner.cookie).send({ title: 'x' }).expect(201);
      await expectSilence(viewer, 'event');
    });

    it('a removed member falls back to defaultRole instead of being evicted', async () => {
      const f = await roleFixture(t, 'VIEWER');
      const editor = await open(f.editor);
      await editor.join(f.tierlist.id);
      await remove(f.moderator, f.tierlist.id, f.editor).expect(204);
      expect(await editor.next('role.changed')).toEqual({ tierlistId: f.tierlist.id, effectiveRole: 'VIEWER' });
      await expectSilence(editor, 'access.revoked');
    });

    it('a demoted editor is told immediately and the API refuses its writes', async () => {
      const f = await roleFixture(t);
      const editor = await open(f.editor);
      await editor.join(f.tierlist.id);
      await patchRole(f.moderator, f.tierlist.id, f.editor, 'VIEWER').expect(200);
      expect(await editor.next('role.changed')).toEqual({ tierlistId: f.tierlist.id, effectiveRole: 'VIEWER' });
      await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.editor.cookie).send({ title: 'x' }).expect(403);
    });

    it('a member who leaves is evicted from the room', async () => {
      const f = await roleFixture(t);
      const viewer = await open(f.viewer);
      await viewer.join(f.tierlist.id);
      await http().post(`/api/tierlists/${f.tierlist.id}/leave`).set('Cookie', f.viewer.cookie).expect(204);
      expect(await viewer.next('access.revoked')).toMatchObject({ reason: 'revoked' });
    });
  });
});
