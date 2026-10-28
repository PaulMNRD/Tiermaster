import { z } from 'zod';
import { RoleSchema } from './roles';

/** Socket.IO path, routed to the API by the reverse proxy (ADR 0006). */
export const SOCKET_PATH = '/ws';

/** Client -> server messages. The gateway accepts no modification: writes go through REST. */
export const JoinRequestSchema = z.object({ tierlistId: z.uuid() }).strict();
export type JoinRequest = z.infer<typeof JoinRequestSchema>;
export const LeaveRequestSchema = JoinRequestSchema;

export const JoinAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), effectiveRole: RoleSchema, rev: z.number().int() }),
  /** `not_found` for any user without role: the existence of a private tierlist is never leaked. */
  z.object({ ok: z.literal(false), error: z.enum(['not_found', 'invalid']) }),
]);
export type JoinAck = z.infer<typeof JoinAckSchema>;

/** Server -> client messages (besides `event`, which carries a TierlistEvent). */
export const ServerMessages = {
  event: 'event',
  accessRevoked: 'access.revoked',
  roleChanged: 'role.changed',
  notification: 'notification',
  authError: 'auth_error',
} as const;

export const AccessRevokedSchema = z.object({ tierlistId: z.uuid(), reason: z.enum(['revoked', 'deleted']) });
export type AccessRevoked = z.infer<typeof AccessRevokedSchema>;

export const RoleChangedSchema = z.object({ tierlistId: z.uuid(), effectiveRole: RoleSchema });
export type RoleChanged = z.infer<typeof RoleChangedSchema>;

export const NotificationSchema = z.object({ type: z.enum(['invitations.changed']) });
export type Notification = z.infer<typeof NotificationSchema>;
