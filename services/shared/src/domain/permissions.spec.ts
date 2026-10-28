import { describe, expect, it } from 'vitest';
import type { DefaultRole, MemberRole, Role } from '../types';
import { ACTIONS, type Action, can, canGrant, effectiveRole, grantsMoreAccess } from './permissions';

const OWNER_ID = 'owner';
const USER_ID = 'user';

describe('effectiveRole', () => {
  // [description, userId, membership, defaultRole, expected]
  const cases: [string, string | null, MemberRole | null, DefaultRole, Role | null][] = [
    // Owner always wins, whatever the membership or default role.
    ['owner, private', OWNER_ID, null, null, 'OWNER'],
    ['owner, default VIEWER', OWNER_ID, null, 'VIEWER', 'OWNER'],
    ['owner, default EDITOR', OWNER_ID, null, 'EDITOR', 'OWNER'],
    ['owner with a stray membership', OWNER_ID, 'VIEWER', null, 'OWNER'],
    // Explicit membership wins over defaultRole, even when it grants less.
    ['moderator, private', USER_ID, 'MODERATOR', null, 'MODERATOR'],
    ['moderator, default VIEWER', USER_ID, 'MODERATOR', 'VIEWER', 'MODERATOR'],
    ['moderator, default EDITOR', USER_ID, 'MODERATOR', 'EDITOR', 'MODERATOR'],
    ['editor, private', USER_ID, 'EDITOR', null, 'EDITOR'],
    ['editor, default VIEWER', USER_ID, 'EDITOR', 'VIEWER', 'EDITOR'],
    ['editor, default EDITOR', USER_ID, 'EDITOR', 'EDITOR', 'EDITOR'],
    ['viewer, private', USER_ID, 'VIEWER', null, 'VIEWER'],
    ['viewer, default VIEWER', USER_ID, 'VIEWER', 'VIEWER', 'VIEWER'],
    ['viewer restricted below default EDITOR', USER_ID, 'VIEWER', 'EDITOR', 'VIEWER'],
    // No membership: defaultRole applies.
    ['stranger, private', USER_ID, null, null, null],
    ['stranger, default VIEWER', USER_ID, null, 'VIEWER', 'VIEWER'],
    ['stranger, default EDITOR', USER_ID, null, 'EDITOR', 'EDITOR'],
    // Anonymous visitors are capped at VIEWER.
    ['anonymous, private', null, null, null, null],
    ['anonymous, default VIEWER', null, null, 'VIEWER', 'VIEWER'],
    ['anonymous capped, default EDITOR', null, null, 'EDITOR', 'VIEWER'],
  ];

  it.each(cases)('%s', (_, userId, membershipRole, defaultRole, expected) => {
    expect(effectiveRole({ userId, ownerId: OWNER_ID, membershipRole, defaultRole })).toBe(expected);
  });
});

describe('can', () => {
  // Hand-written copy of the permission matrix in docs/features/roles-and-permissions.md.
  //                                       none   viewer editor moderator owner
  const matrix: Record<Action, [boolean, boolean, boolean, boolean, boolean]> = {
    'tierlist.read': [false, true, true, true, true],
    'card.write': [false, false, true, true, true],
    'category.write': [false, false, true, true, true],
    'media.upload': [false, false, true, true, true],
    'tierlist.rename': [false, false, true, true, true],
    'member.invite': [false, false, false, true, true],
    'member.manage': [false, false, false, true, true],
    'moderator.manage': [false, false, false, false, true],
    'tierlist.changeDefaultRole': [false, false, false, false, true],
    'tierlist.delete': [false, false, false, false, true],
    'tierlist.leave': [false, true, true, true, false],
  };
  const roles: (Role | null)[] = [null, 'VIEWER', 'EDITOR', 'MODERATOR', 'OWNER'];

  it('covers every action', () => {
    expect(Object.keys(matrix).sort()).toEqual([...ACTIONS].sort());
  });

  const rows = Object.entries(matrix).flatMap(([action, expected]) =>
    roles.map((role, i) => [action as Action, role, expected[i]] as const),
  );
  it.each(rows)('%s by %s -> %s', (action, role, expected) => {
    expect(can(role, action)).toBe(expected);
  });
});

describe('canGrant', () => {
  type Next = MemberRole | 'OWNER' | null;
  const targets: (Role | null)[] = [null, 'VIEWER', 'EDITOR', 'MODERATOR', 'OWNER'];
  const nexts: Next[] = [null, 'VIEWER', 'EDITOR', 'MODERATOR', 'OWNER'];

  // Expected result for each (target, next) pair, rows = target, columns = next.
  // next = null means removal; target = null means a user without role (new member, link invitation).
  //                       remove  VIEWER EDITOR MODERATOR OWNER
  const ownerTable: boolean[][] = [
    /* none      */ [true, true, true, true, false],
    /* VIEWER    */ [true, true, true, true, false],
    /* EDITOR    */ [true, true, true, true, false],
    /* MODERATOR */ [true, true, true, true, false],
    /* OWNER     */ [false, false, false, false, false],
  ];
  const moderatorTable: boolean[][] = [
    /* none      */ [true, true, true, false, false],
    /* VIEWER    */ [true, true, true, false, false],
    /* EDITOR    */ [true, true, true, false, false],
    /* MODERATOR */ [false, false, false, false, false],
    /* OWNER     */ [false, false, false, false, false],
  ];
  const deniedTable: boolean[][] = targets.map(() => nexts.map(() => false));

  const tables: [Role | null, boolean[][]][] = [
    ['OWNER', ownerTable],
    ['MODERATOR', moderatorTable],
    ['EDITOR', deniedTable],
    ['VIEWER', deniedTable],
    [null, deniedTable],
  ];

  const rows = tables.flatMap(([actor, table]) =>
    targets.flatMap((target, t) => nexts.map((next, n) => [actor, target, next, table[t]![n]!] as const)),
  );
  it.each(rows)('actor %s, target %s, next %s -> %s', (actor, target, next, expected) => {
    expect(canGrant(actor, target, next)).toBe(expected);
  });
});

describe('grantsMoreAccess', () => {
  const cases: [Role | null, MemberRole, boolean][] = [
    [null, 'VIEWER', true],
    [null, 'MODERATOR', true],
    ['VIEWER', 'VIEWER', false],
    ['VIEWER', 'EDITOR', true],
    ['EDITOR', 'VIEWER', false],
    ['EDITOR', 'MODERATOR', true],
    ['MODERATOR', 'EDITOR', false],
    ['MODERATOR', 'MODERATOR', false],
    ['OWNER', 'MODERATOR', false],
  ];
  it.each(cases)('from %s to %s -> %s', (current, next, expected) => {
    expect(grantsMoreAccess(current, next)).toBe(expected);
  });
});
