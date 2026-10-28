import { z } from 'zod';
import { DefaultRoleSchema, MemberRoleSchema, RoleSchema } from './roles';
import { ClientOpIdSchema } from './tierlists';

export const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color_invalid');
export const PositionSchema = z.string().regex(/^[0-9A-Za-z]*[1-9A-Za-z]$/, 'position_invalid').max(200);

export const CategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
  position: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CardSchema = z.object({
  id: z.uuid(),
  /** null means the unsorted pool. */
  categoryId: z.uuid().nullable(),
  title: z.string(),
  imageKey: z.string().nullable(),
  position: z.string(),
});
export type Card = z.infer<typeof CardSchema>;

/** Full state of a tierlist, as returned by `GET /api/tierlists/:id`. Categories and cards are in display order. */
export const TierlistSnapshotSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  ownerId: z.uuid(),
  defaultRole: DefaultRoleSchema,
  rev: z.number().int(),
  effectiveRole: RoleSchema,
  categories: z.array(CategorySchema),
  cards: z.array(CardSchema),
});
export type TierlistSnapshot = z.infer<typeof TierlistSnapshotSchema>;

// ---- Events (REST writes produce them, the gateway broadcasts them, `/ops` replays them) ----

const meta = {
  tierlistId: z.uuid(),
  rev: z.number().int(),
  clientOpId: z.string().nullable(),
  authorId: z.uuid().nullable(),
};
const event = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.object({ ...meta, type: z.literal(type), payload });

export const TierlistEventSchema = z.discriminatedUnion('type', [
  event('tierlist.updated', z.object({ title: z.string().optional(), defaultRole: DefaultRoleSchema.optional() })),
  event('category.created', z.object({ category: CategorySchema })),
  event('category.updated', z.object({ category: CategorySchema })),
  event(
    'category.deleted',
    z.object({ categoryId: z.uuid(), movedCards: z.array(z.object({ id: z.uuid(), position: z.string() })) }),
  ),
  event('card.created', z.object({ card: CardSchema })),
  event('card.updated', z.object({ card: CardSchema })),
  event('card.moved', z.object({ cardId: z.uuid(), categoryId: z.uuid().nullable(), position: z.string() })),
  event('card.deleted', z.object({ cardId: z.uuid() })),
  event('member.added', z.object({ userId: z.uuid(), role: MemberRoleSchema })),
  event('member.updated', z.object({ userId: z.uuid(), role: MemberRoleSchema })),
  event('member.removed', z.object({ userId: z.uuid() })),
]);
export type TierlistEvent = z.infer<typeof TierlistEventSchema>;
export type TierlistEventType = TierlistEvent['type'];
export type EventPayload<T extends TierlistEventType> = Extract<TierlistEvent, { type: T }>['payload'];

export const OpsResponseSchema = z.object({ rev: z.number().int(), ops: z.array(TierlistEventSchema) });
export type OpsResponse = z.infer<typeof OpsResponseSchema>;

/** Answer to every write: the rev assigned to it (the event follows on the socket). */
export const WriteResultSchema = z.object({ rev: z.number().int() });

// ---- Write payloads ----

export const CreateCategorySchema = z
  .object({
    clientOpId: ClientOpIdSchema.optional(),
    name: z.string().trim().min(1).max(40),
    color: ColorSchema,
    /** Insert after this category; null or absent inserts first. */
    afterId: z.uuid().nullable().optional(),
  })
  .strict();
export type CreateCategory = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z
  .object({
    clientOpId: ClientOpIdSchema.optional(),
    name: z.string().trim().min(1).max(40).optional(),
    color: ColorSchema.optional(),
  })
  .strict()
  .refine((b) => b.name !== undefined || b.color !== undefined, 'nothing_to_update');
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

/** Reorder: place the category right after `afterId` (null = first). */
export const MoveCategorySchema = z
  .object({ clientOpId: ClientOpIdSchema.optional(), afterId: z.uuid().nullable() })
  .strict();
export type MoveCategory = z.infer<typeof MoveCategorySchema>;

export const CardTitleSchema = z.string().trim().min(1).max(80);
export const ImageKeySchema = z.string().regex(/^tierlists\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/, 'image_key_invalid');

export const CreateCardSchema = z
  .object({
    clientOpId: ClientOpIdSchema.optional(),
    title: CardTitleSchema,
    imageKey: ImageKeySchema.nullable().optional(),
    /** Target category; null or absent puts the card in the unsorted pool (at the end). */
    categoryId: z.uuid().nullable().optional(),
  })
  .strict();
export type CreateCard = z.infer<typeof CreateCardSchema>;

export const UpdateCardSchema = z
  .object({
    clientOpId: ClientOpIdSchema.optional(),
    title: CardTitleSchema.optional(),
    imageKey: ImageKeySchema.nullable().optional(),
  })
  .strict()
  .refine((b) => b.title !== undefined || b.imageKey !== undefined, 'nothing_to_update');
export type UpdateCard = z.infer<typeof UpdateCardSchema>;

/** Move a card into `toCategoryId` (null = pool), right after `afterCardId` (null = first). */
export const MoveCardSchema = z
  .object({
    clientOpId: ClientOpIdSchema.optional(),
    toCategoryId: z.uuid().nullable(),
    afterCardId: z.uuid().nullable(),
  })
  .strict();
export type MoveCard = z.infer<typeof MoveCardSchema>;

export const DeleteQuerySchema = z.object({ clientOpId: ClientOpIdSchema.optional() });

export const OpsQuerySchema = z.object({ since: z.coerce.number().int().min(0) });
