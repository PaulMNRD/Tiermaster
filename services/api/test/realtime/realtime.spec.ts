import type { TierlistEvent } from '@tiermaster/shared';
import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { roleFixture } from '../support/fixtures.js';
import { connect, expectSilence, type TestSocket } from '../support/sockets.js';

describe('real-time gateway', () => {
  let t: TestApp;
  const sockets: TestSocket[] = [];
  const http = () => request(t.app.getHttpServer());
  const open = async (...args: Parameters<typeof connect>) => {
    const client = await connect(...args);
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

  it('broadcasts a committed write to every client in the room, with rev and clientOpId', async () => {
    const f = await roleFixture(t);
    const editor = await open(t, f.editor);
    const viewer = await open(t, f.viewer);
    expect(await editor.join(f.tierlist.id)).toEqual({ ok: true, effectiveRole: 'EDITOR', rev: 0 });
    expect(await viewer.join(f.tierlist.id)).toEqual({ ok: true, effectiveRole: 'VIEWER', rev: 0 });

    const res = await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.editor.cookie).send({ title: 'Live', clientOpId: 'op-42' }).expect(201);
    const [a, b] = await Promise.all([editor.next<TierlistEvent>('event'), viewer.next<TierlistEvent>('event')]);
    for (const event of [a, b]) {
      expect(event).toMatchObject({ type: 'card.created', rev: 1, clientOpId: 'op-42', authorId: f.editor.id, tierlistId: f.tierlist.id });
    }
    expect(res.body.rev).toBe(1);

    await http().patch(`/api/tierlists/${f.tierlist.id}/cards/${res.body.card.id}/move`).set('Cookie', f.editor.cookie)
      .send({ toCategoryId: null, afterCardId: null }).expect(200);
    expect(await viewer.next<TierlistEvent>('event')).toMatchObject({ type: 'card.moved', rev: 2 });
  });

  it('returns the current rev in the join ack (gap detection)', async () => {
    const f = await roleFixture(t, 'VIEWER');
    await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.owner.cookie).send({ title: 'a' }).expect(201);
    const anonymous = await open(t, null);
    expect(await anonymous.join(f.tierlist.id)).toEqual({ ok: true, effectiveRole: 'VIEWER', rev: 1 });
  });

  it('caps anonymous sockets at VIEWER even when defaultRole is EDITOR', async () => {
    const f = await roleFixture(t, 'EDITOR');
    const anonymous = await open(t, null);
    const stranger = await open(t, f.stranger);
    expect(await anonymous.join(f.tierlist.id)).toMatchObject({ ok: true, effectiveRole: 'VIEWER' });
    expect(await stranger.join(f.tierlist.id)).toMatchObject({ ok: true, effectiveRole: 'EDITOR' });
  });

  it('does not send events to sockets outside the room', async () => {
    const f = await roleFixture(t);
    const outsider = await open(t, f.viewer);
    await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.owner.cookie).send({ title: 'a' }).expect(201);
    await expectSilence(outsider, 'event');
  });

  describe('rejected', () => {
    it('join returns not_found for a stranger or an anonymous visitor on a private tierlist, and for unknown ids', async () => {
      const f = await roleFixture(t);
      const stranger = await open(t, f.stranger);
      const anonymous = await open(t, null);
      expect(await stranger.join(f.tierlist.id)).toEqual({ ok: false, error: 'not_found' });
      expect(await anonymous.join(f.tierlist.id)).toEqual({ ok: false, error: 'not_found' });
      expect(await stranger.join(crypto.randomUUID())).toEqual({ ok: false, error: 'not_found' });
      await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.owner.cookie).send({ title: 'secret' }).expect(201);
      await expectSilence(stranger, 'event');
    });

    it('join validates its payload', async () => {
      const client = await open(t, null);
      expect(await client.join('not-a-uuid')).toEqual({ ok: false, error: 'invalid' });
    });

    it('disconnects a socket presenting an invalid token (never silently anonymous)', async () => {
      const client = await open(t, null, 'forged.token');
      const reason = await client.next('disconnect');
      expect(reason).toBe('io server disconnect');
      expect(client.received.get('auth_error')).toEqual([{ code: 'invalid_token' }]);
    });
  });

  describe('revoked mid-session', () => {
    it('evicts sockets without remaining access when the tierlist becomes private', async () => {
      const f = await roleFixture(t, 'VIEWER');
      const stranger = await open(t, f.stranger);
      const anonymous = await open(t, null);
      const viewer = await open(t, f.viewer);
      await stranger.join(f.tierlist.id);
      await anonymous.join(f.tierlist.id);
      await viewer.join(f.tierlist.id);

      await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ defaultRole: null }).expect(200);
      expect(await stranger.next('access.revoked')).toEqual({ tierlistId: f.tierlist.id, reason: 'revoked' });
      expect(await anonymous.next('access.revoked')).toEqual({ tierlistId: f.tierlist.id, reason: 'revoked' });

      // Evicted sockets receive nothing afterwards; the member keeps receiving.
      stranger.received.clear();
      await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.owner.cookie).send({ title: 'after' }).expect(201);
      const events: TierlistEvent[] = [await viewer.next('event'), await viewer.next('event')];
      expect(events.map((e) => e.type)).toEqual(['tierlist.updated', 'card.created']);
      await expectSilence(stranger, 'event');
      expect(viewer.received.get('access.revoked') ?? []).toEqual([]);
    });

    it('downgrades connected users when defaultRole goes from EDITOR to VIEWER', async () => {
      const f = await roleFixture(t, 'EDITOR');
      const stranger = await open(t, f.stranger);
      const editor = await open(t, f.editor);
      await stranger.join(f.tierlist.id);
      await editor.join(f.tierlist.id);
      await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ defaultRole: 'VIEWER' }).expect(200);
      expect(await stranger.next('role.changed')).toEqual({ tierlistId: f.tierlist.id, effectiveRole: 'VIEWER' });
      await expectSilence(editor, 'role.changed');
      // The REST layer enforces the new role too.
      await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.stranger.cookie).send({ title: 'x' }).expect(403);
    });

    it('evicts everyone when the tierlist is deleted', async () => {
      const f = await roleFixture(t);
      const viewer = await open(t, f.viewer);
      await viewer.join(f.tierlist.id);
      await http().delete(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).expect(204);
      expect(await viewer.next('access.revoked')).toEqual({ tierlistId: f.tierlist.id, reason: 'deleted' });
    });

    it('a rejoin after losing access fails with not_found', async () => {
      const f = await roleFixture(t, 'VIEWER');
      const stranger = await open(t, f.stranger);
      await stranger.join(f.tierlist.id);
      await http().patch(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).send({ defaultRole: null }).expect(200);
      await stranger.next('access.revoked');
      expect(await stranger.join(f.tierlist.id)).toEqual({ ok: false, error: 'not_found' });
    });
  });
});
