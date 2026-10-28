import { z } from 'zod';

/** Every effective role, from most to least privileged. */
export const RoleSchema = z.enum(['OWNER', 'MODERATOR', 'EDITOR', 'VIEWER']);
export type Role = z.infer<typeof RoleSchema>;

/** Roles that can be stored on a membership or an invitation. */
export const MemberRoleSchema = z.enum(['MODERATOR', 'EDITOR', 'VIEWER']);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

/** Access granted to users without membership. `null` means private. */
export const DefaultRoleSchema = z.enum(['EDITOR', 'VIEWER']).nullable();
export type DefaultRole = z.infer<typeof DefaultRoleSchema>;
