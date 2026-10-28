import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { cardsIn, type JoinAck, type TierlistEvent, type TierlistSnapshot } from '@tiermaster/shared';
import { AuthService } from '../../core/auth/auth.service';
import { ContentApi } from '../../core/api/content.api';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { snapshot } from '../../../testing/helpers';
import { TierlistStore } from './tierlist.store';

const ID = '00000000-0000-4000-8000-000000000001';
const S = '00000000-0000-4000-8000-0000000000a1';
const A = '00000000-0000-4000-8000-0000000000a2';
const RUST = '00000000-0000-4000-8000-000000000101';
const TS = '00000000-0000-4000-8000-000000000102';
const COBOL = '00000000-0000-4000-8000-000000000103';

const flush = () => new Promise((resolve) => setTimeout(resolve));
const httpError = (status: number, code = 'x') => new HttpErrorResponse({ status, error: { statusCode: status, code } });

class FakeRealtime {
  readonly status = signal('connected');
  readonly handlers = new Map<string, (payload: unknown) => void>();
  reconnectHandler: (() => void) | null = null;
  joinAck: JoinAck = { ok: true, effectiveRole: 'EDITOR', rev: 3 };
  joins = 0;
  connect() {}
  join = vi.fn(async () => {
    this.joins++;
    return this.joinAck;
  });
  leave = vi.fn();
  on(name: string, handler: (payload: unknown) => void) {
    this.handlers.set(name, handler);
    return () => this.handlers.delete(name);
  }
  onReconnect(handler: () => void) {
    this.reconnectHandler = handler;
    return () => (this.reconnectHandler = null);
  }
  emit(name: string, payload: unknown) {
    this.handlers.get(name)?.(payload);
  }
}

function event<T extends TierlistEvent['type']>(type: T, rev: number, payload: Extract<TierlistEvent, { type: T }>['payload'], clientOpId: string | null = null) {
  return { tierlistId: ID, rev, clientOpId, authorId: null, type, payload } as TierlistEvent;
}

describe('TierlistStore', () => {
  let store: TierlistStore;
  let realtime: FakeRealtime;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let snap: TierlistSnapshot;

  beforeEach(async () => {
    snap = snapshot({ effectiveRole: 'EDITOR' });
    realtime = new FakeRealtime();
    api = {
      snapshot: vi.fn(async () => structuredClone(snap)),
      opsSince: vi.fn(),
      moveCard: vi.fn(),
      createCard: vi.fn(),
      deleteCard: vi.fn(),
      updateCard: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        TierlistStore,
        { provide: ContentApi, useValue: api },
        { provide: RealtimeService, useValue: realtime },
        { provide: AuthService, useValue: { me: signal({ id: '00000000-0000-4000-8000-0000000000ee' }) } },
      ],
    });
    store = TestBed.inject(TierlistStore);
    await store.load(ID);
  });

  const titlesIn = (categoryId: string | null) => cardsIn(store.view()!, categoryId).map((c) => c.title);

  it('loads the snapshot, joins the room and takes the role from the join ack', () => {
    expect(store.status()).toBe('ready');
    expect(realtime.join).toHaveBeenCalledWith(ID);
    expect(store.role()).toBe('EDITOR');
  });

  it('applies a move optimistically, then confirms it with its own event', async () => {
    let resolve!: (value: { rev: number }) => void;
    api['moveCard']!.mockReturnValue(new Promise((r) => (resolve = r)));
    void store.moveCard(COBOL, S, TS);
    expect(titlesIn(S)).toEqual(['TypeScript', 'COBOL', 'Rust']);
    expect(store.pendingCount()).toBe(1);

    const [, , body] = api['moveCard']!.mock.calls[0]!;
    realtime.emit('event', event('card.moved', 4, { cardId: COBOL, categoryId: S, position: 'b' }, body.clientOpId));
    expect(store.pendingCount()).toBe(0);
    expect(store.confirmed()!.rev).toBe(4);
    resolve({ rev: 4 });
    await flush();
    expect(titlesIn(S)).toEqual(['TypeScript', 'COBOL', 'Rust']);
  });

  it('confirms by the HTTP answer when it arrives first, and the later event is ignored', async () => {
    api['moveCard']!.mockResolvedValue({ rev: 4 });
    await store.moveCard(COBOL, A, null);
    const [, , body] = api['moveCard']!.mock.calls[0]!;
    expect(store.pendingCount()).toBe(1);
    realtime.emit('event', event('card.moved', 4, { cardId: COBOL, categoryId: A, position: 'V' }, body.clientOpId));
    expect(store.pendingCount()).toBe(0);
    expect(titlesIn(A)).toEqual(['COBOL']);
    realtime.emit('event', event('card.moved', 4, { cardId: COBOL, categoryId: A, position: 'V' }, body.clientOpId));
    expect(store.confirmed()!.rev).toBe(4);
  });

  it('rolls back when the server rejects the write (403)', async () => {
    api['moveCard']!.mockRejectedValue(httpError(403, 'forbidden'));
    await store.moveCard(COBOL, A, null);
    expect(titlesIn(A)).toEqual([]);
    expect(titlesIn(null)).toEqual(['COBOL']);
    expect(store.pendingCount()).toBe(0);
    expect(store.notice()).toBe('error.403.body');
  });

  it('retries a network failure with the same clientOpId', async () => {
    vi.useFakeTimers();
    try {
      api['moveCard']!.mockRejectedValueOnce(httpError(0)).mockResolvedValueOnce({ rev: 4 });
      const done = store.moveCard(COBOL, A, null);
      await vi.runAllTimersAsync();
      await done;
      const ids = api['moveCard']!.mock.calls.map((call) => call[2].clientOpId);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies remote events and replays pending ops on top', async () => {
    api['moveCard']!.mockReturnValue(new Promise(() => {}));
    void store.moveCard(COBOL, A, null);
    realtime.emit('event', event('card.deleted', 4, { cardId: RUST }));
    expect(titlesIn(S)).toEqual(['TypeScript']);
    expect(titlesIn(A)).toEqual(['COBOL']);
    expect(store.confirmed()!.rev).toBe(4);
  });

  it('detects a gap and fetches the missing ops in order', async () => {
    api['opsSince']!.mockResolvedValue({
      rev: 5,
      ops: [event('card.deleted', 4, { cardId: RUST }), event('card.deleted', 5, { cardId: TS })],
    });
    realtime.emit('event', event('card.deleted', 6, { cardId: COBOL }));
    await flush();
    expect(api['opsSince']).toHaveBeenCalledWith(ID, 3);
    expect(store.confirmed()!.rev).toBe(6);
    expect(store.view()!.cards).toEqual([]);
  });

  it('reloads the snapshot when the gap is too large (410)', async () => {
    api['opsSince']!.mockRejectedValue(httpError(410, 'resync_required'));
    snap = snapshot({ rev: 40, title: 'Fresh' });
    realtime.emit('event', event('card.deleted', 41, { cardId: COBOL }));
    await flush();
    await flush();
    expect(api['snapshot']).toHaveBeenCalledTimes(2);
    expect(store.view()!.title).toBe('Fresh');
    expect(store.confirmed()!.rev).toBe(41);
  });

  it('rejoins and resynchronizes after a reconnection', async () => {
    realtime.joinAck = { ok: true, effectiveRole: 'VIEWER', rev: 4 };
    api['opsSince']!.mockResolvedValue({ rev: 4, ops: [event('card.deleted', 4, { cardId: RUST })] });
    realtime.reconnectHandler!();
    await flush();
    expect(realtime.joins).toBe(2);
    expect(store.role()).toBe('VIEWER');
    expect(store.confirmed()!.rev).toBe(4);
  });

  it('closes the tierlist when access is revoked (live or on rejoin)', async () => {
    realtime.emit('access.revoked', { tierlistId: ID, reason: 'revoked' });
    expect(store.status()).toBe('revoked');

    await store.load(ID);
    realtime.joinAck = { ok: false, error: 'not_found' };
    realtime.reconnectHandler!();
    await flush();
    expect(store.status()).toBe('revoked');
  });

  it('updates the role on role.changed (editing disabled after a demotion)', () => {
    expect(store.canEdit()).toBe(true);
    realtime.emit('role.changed', { tierlistId: ID, effectiveRole: 'VIEWER' });
    expect(store.role()).toBe('VIEWER');
    expect(store.canEdit()).toBe(false);
  });

  it('ignores events of other tierlists', () => {
    realtime.emit('event', { ...event('card.deleted', 4, { cardId: RUST }), tierlistId: '00000000-0000-4000-8000-00000000ffff' });
    expect(store.confirmed()!.rev).toBe(3);
  });

  it('creates a card optimistically with a client-generated id', async () => {
    api['createCard']!.mockReturnValue(new Promise(() => {}));
    void store.createCard('Zig', null);
    expect(titlesIn(null)).toEqual(['COBOL', 'Zig']);
    const [, body] = api['createCard']!.mock.calls[0]!;
    expect(store.view()!.cards.find((c) => c.title === 'Zig')!.id).toBe(body.id);
  });
});
