import { z } from 'zod';
import { DefaultRoleSchema, RoleSchema } from './roles';

/** Client-generated operation id; retrying with the same id is idempotent. */
export const ClientOpIdSchema = z.string().min(1).max(64);

export const TierlistTitleSchema = z.string().trim().min(1).max(100);

export const CreateTierlistSchema = z
  .object({ title: TierlistTitleSchema, defaultRole: DefaultRoleSchema.default(null) })
  .strict();
export type CreateTierlist = z.infer<typeof CreateTierlistSchema>;

export const UpdateTierlistSchema = z
  .object({
    clientOpId: ClientOpIdSchema.optional(),
    title: TierlistTitleSchema.optional(),
    defaultRole: DefaultRoleSchema.optional(),
  })
  .strict()
  .refine((body) => body.title !== undefined || body.defaultRole !== undefined, 'nothing_to_update');
export type UpdateTierlist = z.infer<typeof UpdateTierlistSchema>;

export const TierlistSortSchema = z.enum(['updated', 'created', 'title']);
export type TierlistSort = z.infer<typeof TierlistSortSchema>;

export const ListTierlistsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  sort: TierlistSortSchema.default('updated'),
});
export type ListTierlistsQuery = z.infer<typeof ListTierlistsQuerySchema>;

export const CommunityQuerySchema = ListTierlistsQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type CommunityQuery = z.infer<typeof CommunityQuerySchema>;

export const TierlistSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  defaultRole: DefaultRoleSchema,
  /** Effective role of the current user (null for none). */
  role: RoleSchema.nullable(),
  owner: z.object({ id: z.uuid(), name: z.string().nullable() }),
  cardCount: z.number().int(),
  updatedAt: z.string(),
});
export type TierlistSummary = z.infer<typeof TierlistSummarySchema>;

export const TierlistListSchema = z.object({ items: z.array(TierlistSummarySchema) });
export type TierlistList = z.infer<typeof TierlistListSchema>;

export const TierlistPageSchema = z.object({
  items: z.array(TierlistSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type TierlistPage = z.infer<typeof TierlistPageSchema>;
