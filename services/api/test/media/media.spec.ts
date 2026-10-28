import sharp from 'sharp';
import request from 'supertest';
import { OBJECT_STORAGE, type ObjectStorage } from '../../src/ports/object-storage.port.js';
import { createTestApp, type TestApp } from '../support/app.js';
import { roleFixture, type TestUser } from '../support/fixtures.js';

const png = (width = 1200, height = 800) =>
  sharp({ create: { width, height, channels: 3, background: '#3366ff' } }).png().toBuffer();

describe('media (image pipeline)', () => {
  let t: TestApp;
  let storage: ObjectStorage;
  const http = () => request(t.app.getHttpServer());
  const upload = (user: TestUser | null, tierlistId: string, file: Buffer, filename = 'image.png', contentType = 'image/png') => {
    const req = http().post(`/api/tierlists/${tierlistId}/media`);
    if (user) req.set('Cookie', user.cookie);
    return req.attach('file', file, { filename, contentType });
  };

  beforeAll(async () => {
    t = await createTestApp({ AUTH_FAKE_ENABLED: 'true', STORAGE_DRIVER: 'memory' });
    storage = t.app.get(OBJECT_STORAGE);
  });
  afterAll(() => t.close());

  it('re-encodes an upload to a bounded WebP without metadata, stored under the tierlist', async () => {
    const f = await roleFixture(t);
    const withExif = await sharp(await png()).jpeg().withMetadata({ exif: { IFD0: { Copyright: 'secret-gps' } } }).toBuffer();
    const res = await upload(f.editor, f.tierlist.id, withExif, 'photo.jpg', 'image/jpeg').expect(201);
    expect(res.body.imageKey).toMatch(new RegExp(`^tierlists/${f.tierlist.id}/[0-9a-f-]{36}\\.webp$`));

    const stored = await storage.get(res.body.imageKey);
    const meta = await sharp(stored!.body).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(512);
    expect(meta.exif).toBeUndefined();
  });

  it('serves the image through the API with private caching, to readers only', async () => {
    const f = await roleFixture(t);
    const { body } = await upload(f.owner, f.tierlist.id, await png()).expect(201);
    const res = await http().get(`/api/media/${body.imageKey}`).set('Cookie', f.viewer.cookie).expect(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toBe('private, max-age=300');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body.subarray(8, 12).toString()).toBe('WEBP');
  });

  it('a card can reference an uploaded image; deleting the card deletes the object', async () => {
    const f = await roleFixture(t);
    const { body } = await upload(f.editor, f.tierlist.id, await png()).expect(201);
    const card = await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.editor.cookie).send({ title: 'pic', imageKey: body.imageKey }).expect(201);
    expect(card.body.card.imageKey).toBe(body.imageKey);
    await http().delete(`/api/tierlists/${f.tierlist.id}/cards/${card.body.card.id}`).set('Cookie', f.editor.cookie).expect(200);
    await vi.waitFor(async () => expect(await storage.get(body.imageKey)).toBeNull());
  });

  it('replacing a card image deletes the previous object', async () => {
    const f = await roleFixture(t);
    const first = (await upload(f.editor, f.tierlist.id, await png()).expect(201)).body.imageKey;
    const second = (await upload(f.editor, f.tierlist.id, await png(64, 64)).expect(201)).body.imageKey;
    const card = await http().post(`/api/tierlists/${f.tierlist.id}/cards`).set('Cookie', f.editor.cookie).send({ title: 'pic', imageKey: first }).expect(201);
    await http().patch(`/api/tierlists/${f.tierlist.id}/cards/${card.body.card.id}`).set('Cookie', f.editor.cookie).send({ imageKey: second }).expect(200);
    await vi.waitFor(async () => expect(await storage.get(first)).toBeNull());
    expect(await storage.get(second)).not.toBeNull();
  });

  it('deleting a tierlist deletes its images', async () => {
    const f = await roleFixture(t);
    const key = (await upload(f.owner, f.tierlist.id, await png()).expect(201)).body.imageKey;
    await http().delete(`/api/tierlists/${f.tierlist.id}`).set('Cookie', f.owner.cookie).expect(204);
    await vi.waitFor(async () => expect(await storage.get(key)).toBeNull());
  });

  describe('rejected', () => {
    it('upload needs EDITOR: 403 viewer, 404 stranger, 401 anonymous', async () => {
      const f = await roleFixture(t);
      const image = await png();
      await upload(f.viewer, f.tierlist.id, image).expect(403);
      await upload(f.stranger, f.tierlist.id, image).expect(404);
      await upload(null, f.tierlist.id, image).expect(401);
    });

    it('checks the real type (magic bytes), not the declared one', async () => {
      const f = await roleFixture(t);
      const pdf = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n');
      const res = await upload(f.editor, f.tierlist.id, pdf, 'fake.png', 'image/png').expect(415);
      expect(res.body.code).toBe('unsupported_type');
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
      await upload(f.editor, f.tierlist.id, svg, 'x.svg', 'image/svg+xml').expect(415);
    });

    it('rejects a corrupted image with valid magic bytes', async () => {
      const f = await roleFixture(t);
      const truncated = (await png()).subarray(0, 40);
      const res = await upload(f.editor, f.tierlist.id, truncated).expect(415);
      expect(res.body.code).toBe('invalid_image');
    });

    it('rejects files over the size limit and requests without a file', async () => {
      const f = await roleFixture(t);
      const big = Buffer.concat([await png(), Buffer.alloc(6 * 1024 * 1024)]);
      const res = await upload(f.editor, f.tierlist.id, big).expect(413);
      expect(res.body.code).toBe('file_too_large');
      await http().post(`/api/tierlists/${f.tierlist.id}/media`).set('Cookie', f.editor.cookie).expect(400);
    });

    it('rejects decompression bombs (too many pixels)', async () => {
      const f = await roleFixture(t);
      const huge = await sharp({ create: { width: 12000, height: 12000, channels: 3, background: '#000' } }).png({ compressionLevel: 9 }).toBuffer();
      await upload(f.editor, f.tierlist.id, huge).expect(415);
    });

    it('images follow the tierlist access: 401 anonymous, 404 stranger, 404 after removal (revoked mid-session)', async () => {
      const f = await roleFixture(t);
      const { body } = await upload(f.owner, f.tierlist.id, await png()).expect(201);
      await http().get(`/api/media/${body.imageKey}`).expect(401);
      await http().get(`/api/media/${body.imageKey}`).set('Cookie', f.stranger.cookie).expect(404);
      await http().get(`/api/media/${body.imageKey}`).set('Cookie', f.viewer.cookie).expect(200);
      await http().delete(`/api/tierlists/${f.tierlist.id}/members/${f.viewer.id}`).set('Cookie', f.owner.cookie).expect(204);
      await http().get(`/api/media/${body.imageKey}`).set('Cookie', f.viewer.cookie).expect(404);
    });

    it('rejects malformed keys and unknown images', async () => {
      const f = await roleFixture(t);
      await http().get(`/api/media/tierlists/${f.tierlist.id}/../../etc/passwd`).set('Cookie', f.owner.cookie).expect(404);
      await http().get(`/api/media/tierlists/${f.tierlist.id}/${crypto.randomUUID()}.webp`).set('Cookie', f.owner.cookie).expect(404);
    });
  });

  describe('avatars', () => {
    it('uploads an avatar, exposes it publicly and replaces the previous one', async () => {
      const f = await roleFixture(t);
      await http().post('/api/me/avatar').set('Cookie', f.viewer.cookie).attach('file', await png(), { filename: 'a.png', contentType: 'image/png' }).expect(201);
      const me = await http().get('/api/me').set('Cookie', f.viewer.cookie).expect(200);
      expect(me.body.avatarUrl).toMatch(new RegExp(`^/api/users/${f.viewer.id}/avatar\\?v=`));
      const first = (await t.prisma.user.findUniqueOrThrow({ where: { id: f.viewer.id } })).avatarKey!;
      const res = await http().get(`/api/users/${f.viewer.id}/avatar`).expect(200);
      expect(res.headers['content-type']).toBe('image/webp');

      await http().post('/api/me/avatar').set('Cookie', f.viewer.cookie).attach('file', await png(32, 32), { filename: 'b.png', contentType: 'image/png' }).expect(201);
      await vi.waitFor(async () => expect(await storage.get(first)).toBeNull());
      await http().delete('/api/me/avatar').set('Cookie', f.viewer.cookie).expect(204);
      await http().get(`/api/users/${f.viewer.id}/avatar`).expect(404);
    });

    it('rejected: anonymous upload and non-images', async () => {
      const f = await roleFixture(t);
      await http().post('/api/me/avatar').attach('file', await png(), { filename: 'a.png', contentType: 'image/png' }).expect(401);
      await http().post('/api/me/avatar').set('Cookie', f.viewer.cookie).attach('file', Buffer.from('hello'), { filename: 'a.png', contentType: 'image/png' }).expect(415);
    });
  });
});
