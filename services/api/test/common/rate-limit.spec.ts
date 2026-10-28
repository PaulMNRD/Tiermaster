import sharp from 'sharp';
import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';
import { createTierlist, newUser } from '../support/fixtures.js';

describe('rate limiting', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp({
      AUTH_FAKE_ENABLED: 'true',
      STORAGE_DRIVER: 'memory',
      RATE_LIMIT_WRITES_PER_MINUTE: '5',
      RATE_LIMIT_UPLOADS_PER_MINUTE: '2',
    });
  });
  afterAll(() => t.close());

  it('limits writes per user with 429 and Retry-After; reads are not limited; users are independent', async () => {
    // Signing up uses one write (PATCH /api/me).
    const alice = await newUser(t, 'alice');
    const bob = await newUser(t, 'bob');
    const list = await createTierlist(t, alice, 'Limited');
    for (let i = 0; i < 3; i++) {
      await http().post(`/api/tierlists/${list.id}/cards`).set('Cookie', alice.cookie).send({ title: `c${i}` }).expect(201);
    }
    const res = await http().post(`/api/tierlists/${list.id}/cards`).set('Cookie', alice.cookie).send({ title: 'too many' }).expect(429);
    expect(res.body.code).toBe('rate_limited');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) await http().get(`/api/tierlists/${list.id}`).set('Cookie', alice.cookie).expect(200);
    await createTierlist(t, bob, 'Not limited');
  });

  it('limits uploads separately', async () => {
    const carol = await newUser(t, 'carol');
    const list = await createTierlist(t, carol, 'Uploads');
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
    const upload = () => http().post(`/api/tierlists/${list.id}/media`).set('Cookie', carol.cookie).attach('file', image, { filename: 'a.png', contentType: 'image/png' });
    await upload().expect(201);
    await upload().expect(201);
    await upload().expect(429);
  });
});
