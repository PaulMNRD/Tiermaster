import { TestBed } from '@angular/core/testing';
import type { TierlistSummary } from '@tiermaster/shared';

/** Runs change detection and lets pending promises (resource loaders, HTTP) settle, without waiting on open requests. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  }
}

export const summary = (overrides: Partial<TierlistSummary> = {}): TierlistSummary => ({
  id: crypto.randomUUID(),
  title: 'Fruits',
  defaultRole: null,
  role: 'OWNER',
  owner: { id: crypto.randomUUID(), name: 'Alice' },
  cardCount: 3,
  updatedAt: new Date().toISOString(),
  ...overrides,
});
