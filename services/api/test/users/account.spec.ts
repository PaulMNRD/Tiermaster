import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { addMember, createTierlist, newUser, roleFixture } from '../support/fixtures.js';
import { connect, type TestSocket } from '../support/sockets.js';

describe('account', () => {
  let t: TestApp;
  const sockets: TestSocket[] = [];
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp({ AUTH_FAKE_ENABLED: 'true', STORAGE_DRIVER: 'memory' });
  });
  afterEach(() => {
    for (const s of sockets.splice(0)) s.close();
  });
  afterAll(() => t.close());

  it('changes the pseudonym', async () => {
    const user = await newUser(t, 'renamer');
    const res = await http().patch('/api/me').set('Cookie', user.cookie).send({ name: `${user.name}x` }).expect(200);
    expect(res.body.name).toBe(`${user.name}x`);
  });

  it('deletes the account, its tierlists and memberships; the session stops working', async () => {
    const f = await roleFixture(t);
    const other = await newUser(t, 'other');
    const shared = await createTierlist(t, other, 'Other list');
    await addMember(t, shared.id, f.owner, 'EDITOR');
    const viewerSocket = await connect(t, f.viewer);
    sockets.push(viewerSocket);
    await viewerSocket.join(f.tierlist.id);

    const res = await http().delete('/api/me').set('Cookie', f.owner.cookie).expect(204);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^tm_session=;/);
    expect(await t.prisma.user.count({ where: { id: f.owner.id } })).toBe(0);
    expect(await t.prisma.tierlist.count({ where: { id: f.tierlist.id } })).toBe(0);
    expect(await t.prisma.membership.count({ where: { userId: f.owner.id } })).toBe(0);
    expect(await t.prisma.tierlist.count({ where: { id: shared.id } })).toBe(1);
    expect(await viewerSocket.next('access.revoked')).toEqual({ tierlistId: f.tierlist.id, reason: 'deleted' });
    await http().get('/api/me').set('Cookie', f.owner.cookie).expect(401);
  });

  it('logging in again with the same provider account creates a fresh account', async () => {
    const user = await newUser(t, 'phoenix');
    await http().delete('/api/me').set('Cookie', user.cookie).expect(204);
    const again = await newUser(t, 'phoenix');
    expect(again.id).not.toBe(user.id);
  });

  describe('rejected', () => {
    it('anonymous visitors cannot delete an account', async () => {
      await http().delete('/api/me').expect(401);
    });
  });
});
