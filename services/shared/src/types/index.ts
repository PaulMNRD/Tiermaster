import { z } from 'zod';

export const RoleSchema = z.enum(['READ', 'POSITION', 'EDIT', 'MODERATE']);
export type Role = z.infer<typeof RoleSchema>;

export const DefaultRoleSchema = z.enum(['NONE', 'READ', 'EDIT']);
export type DefaultRole = z.infer<typeof DefaultRoleSchema>;

export const MoveCardOperationSchema = z.object({
  type: z.literal('moveCard'),
  opId: z.string().min(1),
  cardId: z.string().min(1),
  categoryId: z.string().min(1).nullable(),
  position: z.string().min(1),
});
export type MoveCardOperation = z.infer<typeof MoveCardOperationSchema>;

export const OperationSchema = z.discriminatedUnion('type', [MoveCardOperationSchema]);
export type Operation = z.infer<typeof OperationSchema>;
