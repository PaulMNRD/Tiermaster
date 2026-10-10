import type { Role } from '../types';

export const ROLE_RANK: Record<Role, number> = { READ: 1, POSITION: 2, EDIT: 3, MODERATE: 4 };

export function isAtLeast(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
