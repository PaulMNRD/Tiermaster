import { z } from 'zod';
import { MemberRoleSchema, RoleSchema } from './roles';
import { PublicUserSchema } from './users';

export const MemberSchema = z.object({ user: PublicUserSchema, role: RoleSchema });
export type Member = z.infer<typeof MemberSchema>;

/** The owner first, then explicit members. */
export const MembersResponseSchema = z.object({ members: z.array(MemberSchema) });
export type MembersResponse = z.infer<typeof MembersResponseSchema>;

export const ChangeMemberRoleSchema = z.object({ role: MemberRoleSchema }).strict();
export type ChangeMemberRole = z.infer<typeof ChangeMemberRoleSchema>;

export const UserSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(24),
  /** When set, the owner and members of this tierlist are excluded (caller must be allowed to invite). */
  excludeMembersOf: z.uuid().optional(),
});
export type UserSearchQuery = z.infer<typeof UserSearchQuerySchema>;
export const UserSearchResponseSchema = z.object({ users: z.array(PublicUserSchema) });

/** Personal invitation (by pseudonym) when `inviteeId` is set, otherwise a generic link. */
export const CreateInvitationSchema = z
  .object({ role: MemberRoleSchema, inviteeId: z.uuid().optional() })
  .strict();
export type CreateInvitation = z.infer<typeof CreateInvitationSchema>;

export const InvitationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['link', 'user']),
  role: MemberRoleSchema,
  invitee: PublicUserSchema.nullable(),
  createdBy: PublicUserSchema,
  expiresAt: z.string(),
});
export type Invitation = z.infer<typeof InvitationSchema>;

export const CreateInvitationResponseSchema = z.object({
  invitation: InvitationSchema,
  /** Link invitations only: shown once, never retrievable again. */
  url: z.string().nullable(),
});
export type CreateInvitationResponse = z.infer<typeof CreateInvitationResponseSchema>;

export const InvitationsResponseSchema = z.object({ invitations: z.array(InvitationSchema) });

/** Public details of a link, shown on /join/:token before accepting. */
export const InvitationPreviewSchema = z.object({
  tierlistId: z.uuid(),
  tierlistTitle: z.string(),
  role: MemberRoleSchema,
  invitedBy: z.string(),
  expiresAt: z.string(),
});
export type InvitationPreview = z.infer<typeof InvitationPreviewSchema>;

export const AcceptInvitationResponseSchema = z.object({
  tierlistId: z.uuid(),
  /** Effective role after acceptance (unchanged when the invitation would not raise it). */
  role: RoleSchema,
  changed: z.boolean(),
});
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponseSchema>;

/** Pending personal invitations of the current user (home page notification). */
export const MyInvitationSchema = z.object({
  id: z.uuid(),
  tierlist: z.object({ id: z.uuid(), title: z.string() }),
  role: MemberRoleSchema,
  invitedBy: z.string(),
  expiresAt: z.string(),
});
export type MyInvitation = z.infer<typeof MyInvitationSchema>;
export const MyInvitationsResponseSchema = z.object({ invitations: z.array(MyInvitationSchema) });

export const InvitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
