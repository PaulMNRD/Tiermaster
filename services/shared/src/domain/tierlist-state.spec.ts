import { describe, expect, it } from 'vitest';
import type { Card, Category, TierlistEvent } from '../types';
import { applyEvent, cardsIn, positionAfter, sortedCategories, type TierlistState } from './tierlist-state';

const T = '00000000-0000-4000-8000-000000000001';
const S = '00000000-0000-4000-8000-0000000000a1';
const A = '00000000-0000-4000-8000-0000000000a2';
const c = (n: number) => `00000000-0000-4000-8000-00000000010${n}`;

function state(): TierlistState {
  const categories: Category[] = [
    { id: A, name: 'A', color: '#000000', position: 'k' },
    { id: S, name: 'S', color: '#ffffff', position: 'V' },
  ];
  const cards: Card[] = [
    { id: c(1), categoryId: S, title: 'one', imageKey: null, position: 'V' },
    { id: c(2), categoryId: S, title: 'two', imageKey: null, position: 'k' },
    { id: c(3), categoryId: null, title: 'three', imageKey: null, position: 'V' },
  ];
  return { id: T, title: 'T', ownerId: c(9), defaultRole: null, rev: 10, categories, cards };
}

const ev = <E extends TierlistEvent['type']>(type: E, payload: Extract<TierlistEvent, { type: E }>['payload'], rev = 11) =>
  ({ tierlistId: T, rev, clientOpId: null, authorId: null, type, payload }) as TierlistEvent;

describe('ordering helpers', () => {
  it('sorts categories and cards by position', () => {
    expect(sortedCategories(state()).map((x) => x.name)).toEqual(['S', 'A']);
    expect(cardsIn(state(), S).map((x) => x.title)).toEqual(['one', 'two']);
    expect(cardsIn(state(), null).map((x) => x.title)).toEqual(['three']);
  });

  it('computes a position after a sibling, ignoring the moving item', () => {
    const siblings = cardsIn(state(), S);
    expect(positionAfter(siblings, null) < 'V').toBe(true);
    const between = positionAfter(siblings, c(1));
    expect(between > 'V' && between < 'k').toBe(true);
    expect(positionAfter(siblings, c(2)) > 'k').toBe(true);
    // Moving "one" after "two" must not consider "one" itself.
    expect(positionAfter(siblings, c(2), c(1)) > 'k').toBe(true);
    expect(() => positionAfter(siblings, c(3))).toThrow('after_not_found');
  });
});

describe('applyEvent', () => {
  it('moves a card and bumps rev', () => {
    const next = applyEvent(state(), ev('card.moved', { cardId: c(3), categoryId: S, position: 'b' }));
    expect(next.rev).toBe(11);
    expect(cardsIn(next, S).map((x) => x.title)).toEqual(['one', 'three', 'two']);
    expect(cardsIn(next, null)).toEqual([]);
  });

  it('creates, updates and deletes cards', () => {
    const card: Card = { id: c(4), categoryId: null, title: 'four', imageKey: null, position: 'k' };
    let next = applyEvent(state(), ev('card.created', { card }));
    expect(cardsIn(next, null).map((x) => x.title)).toEqual(['three', 'four']);
    next = applyEvent(next, ev('card.updated', { card: { ...card, title: 'FOUR' } }, 12));
    expect(next.cards.find((x) => x.id === c(4))?.title).toBe('FOUR');
    next = applyEvent(next, ev('card.deleted', { cardId: c(4) }, 13));
    expect(next.cards.some((x) => x.id === c(4))).toBe(false);
  });

  it('creating an existing card replaces it (idempotent replay)', () => {
    const card: Card = { id: c(1), categoryId: S, title: 'one!', imageKey: null, position: 'V' };
    const next = applyEvent(state(), ev('card.created', { card }));
    expect(next.cards.filter((x) => x.id === c(1))).toHaveLength(1);
  });

  it('deletes a category and moves its cards to the pool', () => {
    const next = applyEvent(
      state(),
      ev('category.deleted', { categoryId: S, movedCards: [{ id: c(1), position: 'n' }, { id: c(2), position: 'p' }] }),
    );
    expect(next.categories.map((x) => x.id)).toEqual([A]);
    expect(cardsIn(next, null).map((x) => x.title)).toEqual(['three', 'one', 'two']);
  });

  it('creates and updates categories', () => {
    const category: Category = { id: c(5), name: 'B', color: '#123456', position: 'z' };
    let next = applyEvent(state(), ev('category.created', { category }));
    expect(sortedCategories(next).map((x) => x.name)).toEqual(['S', 'A', 'B']);
    next = applyEvent(next, ev('category.updated', { category: { ...category, position: 'B' } }, 12));
    expect(sortedCategories(next).map((x) => x.name)).toEqual(['B', 'S', 'A']);
  });

  it('updates the title and default role', () => {
    const next = applyEvent(state(), ev('tierlist.updated', { title: 'New', defaultRole: 'VIEWER' }));
    expect(next).toMatchObject({ title: 'New', defaultRole: 'VIEWER' });
    expect(applyEvent(next, ev('tierlist.updated', { title: 'Newer' }, 12)).defaultRole).toBe('VIEWER');
  });

  it('only bumps rev for member events', () => {
    const before = state();
    const next = applyEvent(before, ev('member.removed', { userId: c(8) }));
    expect(next).toEqual({ ...before, rev: 11 });
  });

  it('does not mutate the input state', () => {
    const before = state();
    const copy = JSON.parse(JSON.stringify(before)) as TierlistState;
    applyEvent(before, ev('card.deleted', { cardId: c(1) }));
    expect(before).toEqual(copy);
  });
});
