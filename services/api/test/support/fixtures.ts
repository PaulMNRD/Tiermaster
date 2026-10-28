import request from 'supertest';
import type { DefaultRole, MemberRole } from '@tiermaster/shared';
import type { TestApp } from './app.js';
import { signUp } from './auth.js';

export type TestUser = Awaited<ReturnType<typeof signUp>>;

let counter = 0;
/** Signs up a user with a unique pseudonym derived from `base`. */
export function newUser(t: TestApp, base: string): Promise<TestUser> {
  counter += 1;
  return signUp(t, `${base}${counter}`);
}

export async function createTierlist(t: TestApp, owner: TestUser, title = 'My list', defaultRole: DefaultRole = null) {
  const res = await request(t.app.getHttpServer())
    .post('/api/tierlists')
    .set('Cookie', owner.cookie)
    .send({ title, defaultRole })
    .expect(201);
  return res.body as { id: string; title: string };
}

/** Adds a membership directly in the database (the sharing endpoints have their own tests). */
export async function addMember(t: TestApp, tierlistId: string, user: TestUser, role: MemberRole) {
  await t.prisma.membership.create({ data: { tierlistId, userId: user.id, role } });
}

/**
 * One tierlist with a user for every role, plus a stranger.
 * `defaultRole` controls what the stranger and anonymous visitors get.
 */
export async function roleFixture(t: TestApp, defaultRole: DefaultRole = null) {
  const owner = await newUser(t, 'owner');
  const moderator = await newUser(t, 'moderator');
  const editor = await newUser(t, 'editor');
  const viewer = await newUser(t, 'viewer');
  const stranger = await newUser(t, 'stranger');
  const tierlist = await createTierlist(t, owner, 'Fixture', defaultRole);
  await addMember(t, tierlist.id, moderator, 'MODERATOR');
  await addMember(t, tierlist.id, editor, 'EDITOR');
  await addMember(t, tierlist.id, viewer, 'VIEWER');
  return { owner, moderator, editor, viewer, stranger, tierlist };
}
