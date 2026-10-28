import type { Card, Category, TierlistEvent, TierlistSnapshot } from '../types';
import { compareKeys, keyBetween } from './fractional-index';

/** Shared state of a tierlist (the snapshot without the viewer-specific role). */
export type TierlistState = Omit<TierlistSnapshot, 'effectiveRole'>;

interface Positioned {
  id: string;
  position: string;
}

/** Display order: position, then id to break (unexpected) ties deterministically. */
export function byPosition(a: Positioned, b: Positioned): number {
  return compareKeys(a.position, b.position) || compareKeys(a.id, b.id);
}

export function sortedCategories(state: Pick<TierlistState, 'categories'>): Category[] {
  return [...state.categories].sort(byPosition);
}

/** Cards of a category (`null` = unsorted pool), in display order. */
export function cardsIn(state: Pick<TierlistState, 'cards'>, categoryId: string | null): Card[] {
  return state.cards.filter((card) => card.categoryId === categoryId).sort(byPosition);
}

/**
 * Position for an item placed right after `afterId` (null = first) among sorted `siblings`.
 * `movingId` is ignored when present among the siblings (reordering inside the same list).
 */
export function positionAfter(siblings: Positioned[], afterId: string | null, movingId?: string): string {
  const others = siblings.filter((s) => s.id !== movingId);
  if (afterId === null) return keyBetween(null, others[0]?.position ?? null);
  const index = others.findIndex((s) => s.id === afterId);
  if (index < 0) throw new Error('after_not_found');
  const before = others[index]!.position;
  const after = others[index + 1]?.position ?? null;
  // Equal neighbours cannot be split; place after the pair instead of failing.
  return after === null || after > before ? keyBetween(before, after) : keyBetween(before, null);
}

/** Position at the end of a list. */
export function positionAtEnd(siblings: Positioned[]): string {
  const last = [...siblings].sort(byPosition).at(-1);
  return keyBetween(last?.position ?? null, null);
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item];
}

/** Applies one event (pure). Used by the client for live events, replayed ops and optimistic changes. */
export function applyEvent(state: TierlistState, event: TierlistEvent): TierlistState {
  const next: TierlistState = { ...state, rev: event.rev };
  switch (event.type) {
    case 'tierlist.updated':
      if (event.payload.title !== undefined) next.title = event.payload.title;
      if (event.payload.defaultRole !== undefined) next.defaultRole = event.payload.defaultRole;
      return next;
    case 'category.created':
    case 'category.updated':
      next.categories = upsert(state.categories, event.payload.category);
      return next;
    case 'category.deleted': {
      const moved = new Map(event.payload.movedCards.map((m) => [m.id, m.position]));
      next.categories = state.categories.filter((x) => x.id !== event.payload.categoryId);
      next.cards = state.cards.map((card) =>
        card.categoryId === event.payload.categoryId || moved.has(card.id)
          ? { ...card, categoryId: null, position: moved.get(card.id) ?? card.position }
          : card,
      );
      return next;
    }
    case 'card.created':
    case 'card.updated':
      next.cards = upsert(state.cards, event.payload.card);
      return next;
    case 'card.moved':
      next.cards = state.cards.map((card) =>
        card.id === event.payload.cardId ? { ...card, categoryId: event.payload.categoryId, position: event.payload.position } : card,
      );
      return next;
    case 'card.deleted':
      next.cards = state.cards.filter((x) => x.id !== event.payload.cardId);
      return next;
    case 'member.added':
    case 'member.updated':
    case 'member.removed':
      return next;
  }
}
