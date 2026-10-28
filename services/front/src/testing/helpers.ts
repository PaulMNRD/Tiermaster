import { TestBed } from '@angular/core/testing';
import type { TierlistSnapshot, TierlistSummary } from '@tiermaster/shared';

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

const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000001';
const SNAPSHOT_S = '00000000-0000-4000-8000-0000000000a1';
const SNAPSHOT_A = '00000000-0000-4000-8000-0000000000a2';

export function snapshot(overrides: Partial<TierlistSnapshot> = {}): TierlistSnapshot {
  return {
    id: SNAPSHOT_ID,
    title: 'Languages',
    ownerId: '00000000-0000-4000-8000-0000000000ff',
    defaultRole: 'VIEWER',
    rev: 3,
    effectiveRole: 'VIEWER',
    categories: [
      { id: SNAPSHOT_A, name: 'A', color: '#f97316', position: 'k' },
      { id: SNAPSHOT_S, name: 'S', color: '#ef4444', position: 'V' },
    ],
    cards: [
      { id: '00000000-0000-4000-8000-000000000101', categoryId: SNAPSHOT_S, title: 'Rust', imageKey: null, position: 'k' },
      { id: '00000000-0000-4000-8000-000000000102', categoryId: SNAPSHOT_S, title: 'TypeScript', imageKey: null, position: 'V' },
      { id: '00000000-0000-4000-8000-000000000103', categoryId: null, title: 'COBOL', imageKey: null, position: 'V' },
    ],
    ...overrides,
  };
}


/** Inert RealtimeService for component tests (no socket is opened). */
export const realtimeStub = {
  status: () => 'connected',
  on: () => () => {},
  onReconnect: () => () => {},
  leave: () => {},
  reconnect: () => {},
  join: async () => ({ ok: true, effectiveRole: 'VIEWER', rev: 0 }),
};
