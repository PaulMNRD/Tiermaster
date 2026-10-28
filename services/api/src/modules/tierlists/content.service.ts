import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  type Card,
  type Category,
  type CreateCard,
  type CreateCategory,
  keysBetween,
  type MoveCard,
  type MoveCategory,
  type OpsResponse,
  positionAfter,
  positionAtEnd,
  type TierlistEvent,
  type TierlistSnapshot,
  type UpdateCard,
  type UpdateCategory,
} from '@tiermaster/shared';
import type { Tx } from '../../adapters/prisma/transaction.runner.js';
import type { AuthUser } from '../../common/auth.js';
import { apiError, conflict, notFound } from '../../common/errors.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../ports/object-storage.port.js';
import { AccessService } from '../access/access.service.js';
import { ContentRepository } from './content.repository.js';
import { OpsRepository } from './ops.repository.js';
import { TierlistWriter } from './tierlist-writer.service.js';

export const MAX_CARDS = 500;
export const MAX_CATEGORIES = 30;
/** Beyond this gap, `/ops` answers 410 and the client reloads the snapshot. */
export const MAX_OPS_GAP = 500;

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly content: ContentRepository,
    private readonly ops: OpsRepository,
    private readonly writer: TierlistWriter,
    private readonly access: AccessService,
  ) {}

  async snapshot(user: AuthUser | null, tierlistId: string): Promise<TierlistSnapshot> {
    const { role } = await this.access.authorize(user, tierlistId, 'tierlist.read');
    const snapshot = await this.content.snapshot(tierlistId);
    if (!snapshot || !role) throw notFound();
    return { ...snapshot, effectiveRole: role };
  }

  async opsSince(user: AuthUser | null, tierlistId: string, since: number): Promise<OpsResponse> {
    const { tierlist } = await this.access.authorize(user, tierlistId, 'tierlist.read');
    const gone = () => apiError(HttpStatus.GONE, 'resync_required');
    if (since > tierlist.rev || tierlist.rev - since > MAX_OPS_GAP) throw gone();
    const rows = await this.ops.listSince(tierlistId, since, MAX_OPS_GAP);
    if (rows.length !== tierlist.rev - since) throw gone();
    const ops = rows.map(
      (row) =>
        ({
          tierlistId,
          rev: row.rev,
          type: row.type,
          payload: row.payload,
          clientOpId: row.clientOpId,
          authorId: row.authorId,
        }) as TierlistEvent,
    );
    return { rev: tierlist.rev, ops };
  }

  // ---- categories ----

  async createCategory(user: AuthUser, tierlistId: string, body: CreateCategory): Promise<{ rev: number; category: Category }> {
    let category: Category | null = null;
    const { rev } = await this.writer.write({
      user,
      tierlistId,
      clientOpId: body.clientOpId,
      authorize: 'category.write',
      apply: async (tx) => {
        const siblings = await this.content.categories(tx, tierlistId);
        if (siblings.length >= MAX_CATEGORIES) throw conflict('limit_reached');
        if (body.id && (await this.content.idExists(tx, body.id))) throw conflict('id_taken');
        const position = this.place(() => positionAfter(siblings, body.afterId ?? null));
        category = await this.content.createCategory(tx, tierlistId, { id: body.id, name: body.name, color: body.color, position });
        return { type: 'category.created', payload: { category } };
      },
    });
    return { rev, category: category ?? (await this.existingCategory(tierlistId, body.id)) };
  }

  async updateCategory(user: AuthUser, tierlistId: string, id: string, body: UpdateCategory): Promise<{ rev: number }> {
    return this.writer.write({
      user,
      tierlistId,
      clientOpId: body.clientOpId,
      authorize: 'category.write',
      apply: async (tx) => {
        await this.requireCategory(tx, tierlistId, id);
        const category = await this.content.updateCategory(tx, id, { name: body.name, color: body.color });
        return { type: 'category.updated', payload: { category } };
      },
    });
  }

  async moveCategory(user: AuthUser, tierlistId: string, id: string, body: MoveCategory): Promise<{ rev: number }> {
    return this.writer.write({
      user,
      tierlistId,
      clientOpId: body.clientOpId,
      authorize: 'category.write',
      apply: async (tx) => {
        await this.requireCategory(tx, tierlistId, id);
        const siblings = await this.content.categories(tx, tierlistId);
        const position = this.place(() => positionAfter(siblings, body.afterId, id));
        const category = await this.content.updateCategory(tx, id, { position });
        return { type: 'category.updated', payload: { category } };
      },
    });
  }

  /** Deletes a category; its cards go to the end of the unsorted pool, in their previous order. */
  async deleteCategory(user: AuthUser, tierlistId: string, id: string, clientOpId?: string): Promise<{ rev: number }> {
    return this.writer.write({
      user,
      tierlistId,
      clientOpId,
      authorize: 'category.write',
      apply: async (tx) => {
        await this.requireCategory(tx, tierlistId, id);
        const [cards, pool] = await Promise.all([this.content.cardsIn(tx, tierlistId, id), this.content.cardsIn(tx, tierlistId, null)]);
        const positions = keysBetween(pool.at(-1)?.position ?? null, null, cards.length);
        const movedCards = cards.map((card, i) => ({ id: card.id, position: positions[i]! }));
        for (const moved of movedCards) await this.content.updateCard(tx, moved.id, { categoryId: null, position: moved.position });
        await this.content.deleteCategory(tx, id);
        return { type: 'category.deleted', payload: { categoryId: id, movedCards } };
      },
    });
  }

  // ---- cards ----

  async createCard(user: AuthUser, tierlistId: string, body: CreateCard): Promise<{ rev: number; card: Card }> {
    this.checkImageKey(tierlistId, body.imageKey);
    let card: Card | null = null;
    const { rev } = await this.writer.write({
      user,
      tierlistId,
      clientOpId: body.clientOpId,
      authorize: 'card.write',
      apply: async (tx) => {
        const categoryId = body.categoryId ?? null;
        if (categoryId) await this.requireCategory(tx, tierlistId, categoryId);
        if ((await this.content.countCards(tx, tierlistId)) >= MAX_CARDS) throw conflict('limit_reached');
        if (body.id && (await this.content.idExists(tx, body.id))) throw conflict('id_taken');
        const position = positionAtEnd(await this.content.cardsIn(tx, tierlistId, categoryId));
        card = await this.content.createCard(tx, tierlistId, {
          id: body.id,
          title: body.title,
          imageKey: body.imageKey ?? null,
          categoryId,
          position,
        });
        return { type: 'card.created', payload: { card } };
      },
    });
    return { rev, card: card ?? (await this.existingCard(tierlistId, body.id)) };
  }

  async updateCard(user: AuthUser, tierlistId: string, id: string, body: UpdateCard): Promise<{ rev: number }> {
    this.checkImageKey(tierlistId, body.imageKey);
    let replaced: string | null = null;
    const result = await this.writer.write({
      user,
      tierlistId,
      clientOpId: body.clientOpId,
      authorize: 'card.write',
      apply: async (tx) => {
        const previous = (await this.requireCard(tx, tierlistId, id)).imageKey;
        if (body.imageKey !== undefined && previous !== body.imageKey) replaced = previous;
        const card = await this.content.updateCard(tx, id, { title: body.title, imageKey: body.imageKey });
        return { type: 'card.updated', payload: { card } };
      },
    });
    this.discardImage(replaced);
    return result;
  }

  async moveCard(user: AuthUser, tierlistId: string, id: string, body: MoveCard): Promise<{ rev: number }> {
    return this.writer.write({
      user,
      tierlistId,
      clientOpId: body.clientOpId,
      authorize: 'card.write',
      apply: async (tx) => {
        await this.requireCard(tx, tierlistId, id);
        if (body.toCategoryId) await this.requireCategory(tx, tierlistId, body.toCategoryId);
        const siblings = await this.content.cardsIn(tx, tierlistId, body.toCategoryId);
        const position = this.place(() => positionAfter(siblings, body.afterCardId, id));
        await this.content.updateCard(tx, id, { categoryId: body.toCategoryId, position });
        return { type: 'card.moved', payload: { cardId: id, categoryId: body.toCategoryId, position } };
      },
    });
  }

  async deleteCard(user: AuthUser, tierlistId: string, id: string, clientOpId?: string): Promise<{ rev: number; imageKey: string | null }> {
    let imageKey: string | null = null;
    const { rev } = await this.writer.write({
      user,
      tierlistId,
      clientOpId,
      authorize: 'card.write',
      apply: async (tx) => {
        imageKey = (await this.requireCard(tx, tierlistId, id)).imageKey;
        await this.content.deleteCard(tx, id);
        return { type: 'card.deleted', payload: { cardId: id } };
      },
    });
    this.discardImage(imageKey);
    return { rev, imageKey };
  }

  // ---- helpers ----

  /** Best effort, after the commit: a failed deletion leaves an orphan object, never an inconsistent card. */
  private discardImage(key: string | null): void {
    if (!key) return;
    this.storage.delete(key).catch((error: unknown) => this.logger.warn(`Could not delete ${key}: ${String(error)}`));
  }

  private checkImageKey(tierlistId: string, imageKey: string | null | undefined): void {
    if (imageKey && !imageKey.startsWith(`tierlists/${tierlistId}/`)) throw apiError(HttpStatus.BAD_REQUEST, 'image_key_invalid');
  }

  /** The anchor item is not where the client thought: its view is stale. */
  private place(compute: () => string): string {
    try {
      return compute();
    } catch {
      throw conflict('stale_position');
    }
  }

  private async requireCategory(tx: Tx, tierlistId: string, id: string): Promise<Category> {
    const category = await this.content.findCategory(tx, tierlistId, id);
    if (!category) throw notFound('category_not_found');
    return category;
  }

  private async requireCard(tx: Tx, tierlistId: string, id: string): Promise<Card> {
    const card = await this.content.findCard(tx, tierlistId, id);
    if (!card) throw notFound('card_not_found');
    return card;
  }

  /** Idempotent retry of a create: return the entity created the first time. */
  private async existingCard(tierlistId: string, id: string | undefined): Promise<Card> {
    const card = id ? (await this.content.snapshot(tierlistId))?.cards.find((c) => c.id === id) : undefined;
    if (!card) throw notFound('card_not_found');
    return card;
  }

  private async existingCategory(tierlistId: string, id: string | undefined): Promise<Category> {
    const category = id ? (await this.content.snapshot(tierlistId))?.categories.find((c) => c.id === id) : undefined;
    if (!category) throw notFound('category_not_found');
    return category;
  }
}
