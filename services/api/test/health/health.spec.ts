import request from 'supertest';
import { createTestApp, type TestApp } from '../support/app.js';

describe('GET /api/health', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('reports the database as up', async () => {
    const res = await request(t.app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });
});
