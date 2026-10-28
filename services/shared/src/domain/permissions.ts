import type { DefaultRole, MemberRole, Role } from '../types';

/**
 * Single source of truth for authorization (ADR 0004).
 * Every REST endpoint, the Socket.IO gateway and the media module call these functions.
 */

export const ROLE_RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, MODERATOR: 3, OWNER: 4 };

export function isAtLeast(role: Role | null, required: Role): boolean {
  return role !== null && ROLE_RANK[role] >= ROLE_RANK[required];
}

export interface EffectiveRoleInput {
  /** `null` for an anonymous visitor. */
  userId: string | null;
  ownerId: string;
  membershipRole: MemberRole | null;
  defaultRole: DefaultRole;
}

/** Resolves the role of a user on a tierlist; `null` means no access. */
export function effectiveRole({ userId, ownerId, membershipRole, defaultRole }: EffectiveRoleInput): Role | null {
  if (userId === null) return defaultRole === null ? null : 'VIEWER';
  if (userId === ownerId) return 'OWNER';
  if (membershipRole !== null) return membershipRole;
  return defaultRole;
}

export const ACTIONS = [
  'tierlist.read',
  'card.write',
  'category.write',
  'media.upload',
  'tierlist.rename',
  'member.invite',
  'member.manage',
  'moderator.manage',
  'tierlist.changeDefaultRole',
  'tierlist.delete',
  'tierlist.leave',
] as const;
export type Action = (typeof ACTIONS)[number];

const ALLOWED: Record<Action, readonly Role[]> = {
  'tierlist.read': ['VIEWER', 'EDITOR', 'MODERATOR', 'OWNER'],
  'card.write': ['EDITOR', 'MODERATOR', 'OWNER'],
  'category.write': ['EDITOR', 'MODERATOR', 'OWNER'],
  'media.upload': ['EDITOR', 'MODERATOR', 'OWNER'],
  'tierlist.rename': ['EDITOR', 'MODERATOR', 'OWNER'],
  'member.invite': ['MODERATOR', 'OWNER'],
  'member.manage': ['MODERATOR', 'OWNER'],
  'moderator.manage': ['OWNER'],
  'tierlist.changeDefaultRole': ['OWNER'],
  'tierlist.delete': ['OWNER'],
  // The owner cannot leave without transferring ownership (not covered yet).
  'tierlist.leave': ['VIEWER', 'EDITOR', 'MODERATOR'],
};

export function can(role: Role | null, action: Action): boolean {
  return role !== null && ALLOWED[action].includes(role);
}

/**
 * Member-management check: inviting, changing a role or removing a member.
 * @param actor effective role of the user performing the action
 * @param target current role of the target (`null` when the target has none, e.g. a new invitee)
 * @param next role to assign, or `null` for a removal
 */
export function canGrant(actor: Role | null, target: Role | null, next: MemberRole | 'OWNER' | null): boolean {
  if (target === 'OWNER' || next === 'OWNER') return false;
  if (actor === 'OWNER') return true;
  if (actor === 'MODERATOR') {
    if (target === 'MODERATOR') return false;
    return next === null || next === 'EDITOR' || next === 'VIEWER';
  }
  return false;
}

/** Roles an actor may assign to someone else, for UI pickers. */
export function assignableRoles(actor: Role | null): MemberRole[] {
  return (['MODERATOR', 'EDITOR', 'VIEWER'] as const).filter((role) => canGrant(actor, null, role));
}

/** Accepting an invitation never lowers access: true only if `next` is strictly higher than `current`. */
export function grantsMoreAccess(current: Role | null, next: MemberRole): boolean {
  return current === null || ROLE_RANK[next] > ROLE_RANK[current];
}
