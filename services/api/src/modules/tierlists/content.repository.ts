import { Injectable } from '@nestjs/common';
import { byPosition, type Card, type Category } from '@tiermaster/shared';
import { PrismaService } from '../../adapters/prisma/prisma.service.js';
import type { Tx } from '../../adapters/prisma/transaction.runner.js';

const cardSelect = { id: true, categoryId: true, title: true, imageKey: true, position: true } as const;
const categorySelect = { id: true, name: true, color: true, position: true } as const;

@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(tierlistId: string) {
    const tierlist = await this.prisma.tierlist.findUnique({
      where: { id: tierlistId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        defaultRole: true,
        rev: true,
        categories: { select: categorySelect },
        cards: { select: cardSelect },
      },
    });
    if (!tierlist) return null;
    return { ...tierlist, categories: tierlist.categories.sort(byPosition), cards: tierlist.cards.sort(byPosition) };
  }

  // ---- categories ----

  findCategory(tx: Tx, tierlistId: string, id: string): Promise<Category | null> {
    return tx.category.findFirst({ where: { id, tierlistId }, select: categorySelect });
  }

  async categories(tx: Tx, tierlistId: string): Promise<Category[]> {
    return (await tx.category.findMany({ where: { tierlistId }, select: categorySelect })).sort(byPosition);
  }

  createCategory(tx: Tx, tierlistId: string, data: { id?: string; name: string; color: string; position: string }): Promise<Category> {
    return tx.category.create({ data: { ...data, tierlistId }, select: categorySelect });
  }

  updateCategory(tx: Tx, id: string, data: { name?: string; color?: string; position?: string }): Promise<Category> {
    return tx.category.update({ where: { id }, data, select: categorySelect });
  }

  async deleteCategory(tx: Tx, id: string): Promise<void> {
    await tx.category.delete({ where: { id } });
  }

  // ---- cards ----

  findCard(tx: Tx, tierlistId: string, id: string): Promise<Card | null> {
    return tx.card.findFirst({ where: { id, tierlistId }, select: cardSelect });
  }

  /** Cards of one list (`null` = pool), in display order. */
  async cardsIn(tx: Tx, tierlistId: string, categoryId: string | null): Promise<Card[]> {
    return (await tx.card.findMany({ where: { tierlistId, categoryId }, select: cardSelect })).sort(byPosition);
  }

  countCards(tx: Tx, tierlistId: string): Promise<number> {
    return tx.card.count({ where: { tierlistId } });
  }

  createCard(tx: Tx, tierlistId: string, data: Omit<Card, 'id'> & { id?: string }): Promise<Card> {
    return tx.card.create({ data: { ...data, tierlistId }, select: cardSelect });
  }

  updateCard(tx: Tx, id: string, data: Partial<Omit<Card, 'id'>>): Promise<Card> {
    return tx.card.update({ where: { id }, data, select: cardSelect });
  }

  async deleteCard(tx: Tx, id: string): Promise<void> {
    await tx.card.delete({ where: { id } });
  }

  async idExists(tx: Tx, id: string): Promise<boolean> {
    const [card, category] = await Promise.all([tx.card.count({ where: { id } }), tx.category.count({ where: { id } })]);
    return card + category > 0;
  }
}
