import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  AccessRevokedSchema,
  applyEvent,
  can,
  type Card,
  cardsIn,
  type Category,
  type EventPayload,
  keysBetween,
  positionAfter,
  positionAtEnd,
  type Role,
  RoleChangedSchema,
  sortedCategories,
  type TierlistEvent,
  TierlistEventSchema,
  type TierlistEventType,
  type TierlistState,
} from '@tiermaster/shared';
import { type ApiFailure, toApiFailure } from '../../core/api/api-error';
import { ContentApi } from '../../core/api/content.api';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/realtime/realtime.service';

export type LoadStatus = 'loading' | 'ready' | 'error' | 'revoked';

/** A write applied optimistically, waiting for the server (real-time-collaboration.md, "Client-side state"). */
interface PendingOp {
  clientOpId: string;
  /** Optimistic changes, replayed on top of the confirmed state until confirmation. */
  changes: TierlistEvent[];
  /** Rev returned by the HTTP answer; the op is confirmed once the confirmed state reaches it. */
  ackRev: number | null;
}

const MAX_ATTEMPTS = 3;
/** If our own event has not arrived this long after the HTTP answer, fetch the missing ops. */
const CONFIRM_TIMEOUT_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** State of the open tierlist (one instance per tierlist page). */
@Injectable()
export class TierlistStore {
  private readonly api = inject(ContentApi);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);

  readonly status = signal<LoadStatus>('loading');
  readonly failure = signal<ApiFailure | null>(null);
  readonly revokedReason = signal<'revoked' | 'deleted' | null>(null);
  /** Last state confirmed by the server. */
  readonly confirmed = signal<TierlistState | null>(null);
  readonly role = signal<Role | null>(null);
  /** i18n key of the last rejected operation, shown as a toast. */
  readonly notice = signal<string | null>(null);
  private readonly pending = signal<PendingOp[]>([]);

  readonly pendingCount = computed(() => this.pending().length);
  /** What the UI renders: the confirmed state with pending changes replayed on top. */
  readonly view = computed(() => {
    const confirmed = this.confirmed();
    if (!confirmed) return null;
    return this.pending().reduce(
      (state, op) => op.changes.reduce((s, change) => applyEvent(s, { ...change, rev: s.rev }), state),
      confirmed,
    );
  });
  readonly categories = computed(() => {
    const view = this.view();
    return view ? sortedCategories(view).map((category) => ({ ...category, cards: cardsIn(view, category.id) })) : [];
  });
  readonly pool = computed(() => {
    const view = this.view();
    return view ? cardsIn(view, null) : [];
  });
  readonly canEdit = computed(() => can(this.role(), 'card.write'));
  readonly canEditCategories = computed(() => can(this.role(), 'category.write'));
  readonly canRename = computed(() => can(this.role(), 'tierlist.rename'));

  private tierlistId: string | null = null;
  /** Live events received while loading or while catching up, applied in rev order afterwards. */
  private buffer: TierlistEvent[] = [];
  private catchingUp: Promise<void> | null = null;
  private readonly unsubscribers: (() => void)[] = [];

  constructor() {
    inject(DestroyRef, { optional: true })?.onDestroy(() => this.close());
  }

  async load(id: string): Promise<void> {
    this.close();
    this.tierlistId = id;
    this.status.set('loading');
    this.revokedReason.set(null);
    this.pending.set([]);
    this.buffer = [];
    this.subscribe();
    try {
      const { effectiveRole, ...state } = await this.api.snapshot(id);
      if (this.tierlistId !== id) return;
      this.confirmed.set(state);
      this.role.set(effectiveRole);
      this.status.set('ready');
    } catch (error) {
      this.failure.set(toApiFailure(error));
      this.status.set('error');
      return;
    }
    await this.join();
  }

  // ---- real-time ----

  private subscribe(): void {
    this.unsubscribers.push(
      this.realtime.on('event', (payload) => {
        const event = TierlistEventSchema.safeParse(payload);
        if (event.success && event.data.tierlistId === this.tierlistId) this.receive(event.data);
      }),
      this.realtime.on('access.revoked', (payload) => {
        const message = AccessRevokedSchema.safeParse(payload);
        if (message.success && message.data.tierlistId === this.tierlistId) this.revoke(message.data.reason);
      }),
      this.realtime.on('role.changed', (payload) => {
        const message = RoleChangedSchema.safeParse(payload);
        if (message.success && message.data.tierlistId === this.tierlistId) this.role.set(message.data.effectiveRole);
      }),
      this.realtime.onReconnect(() => void this.join()),
    );
  }

  /** Joins the room (again after a reconnection) and catches up with what happened meanwhile. */
  private async join(): Promise<void> {
    const id = this.tierlistId;
    if (!id || this.status() !== 'ready') return;
    let ack;
    try {
      ack = await this.realtime.join(id);
    } catch {
      return; // Not connected: the reconnection handler will join again.
    }
    if (this.tierlistId !== id) return;
    if (!ack.ok) {
      this.revoke('revoked');
      return;
    }
    this.role.set(ack.effectiveRole);
    if (ack.rev > this.confirmed()!.rev) await this.catchUp();
    else this.drain();
  }

  private receive(event: TierlistEvent): void {
    const confirmed = this.confirmed();
    if (!confirmed || this.catchingUp) {
      this.buffer.push(event);
      return;
    }
    if (event.rev <= confirmed.rev) return; // Already applied (e.g. our own op confirmed by a replay).
    if (event.rev === confirmed.rev + 1) {
      this.applyConfirmed(event);
      this.drain();
      return;
    }
    this.buffer.push(event);
    void this.catchUp();
  }

  private applyConfirmed(event: TierlistEvent): void {
    const next = applyEvent(this.confirmed()!, event);
    this.confirmed.set(next);
    this.pending.update((ops) =>
      ops.filter((op) => op.clientOpId !== event.clientOpId && (op.ackRev === null || op.ackRev > next.rev)),
    );
  }

  /** Applies buffered events that directly follow the confirmed rev; starts a catch-up if a gap remains. */
  private drain(): void {
    this.buffer.sort((a, b) => a.rev - b.rev);
    while (this.buffer.length) {
      const rev = this.confirmed()!.rev;
      const next = this.buffer[0]!;
      if (next.rev <= rev) this.buffer.shift();
      else if (next.rev === rev + 1) this.applyConfirmed(this.buffer.shift()!);
      else {
        void this.catchUp();
        return;
      }
    }
  }

  /** Fetches missed ops; reloads the full snapshot when the server says the gap is too large (410). */
  private catchUp(): Promise<void> {
    this.catchingUp ??= this.doCatchUp().finally(() => {
      this.catchingUp = null;
      if (this.status() === 'ready') this.drain();
    });
    return this.catchingUp;
  }

  private async doCatchUp(): Promise<void> {
    const id = this.tierlistId!;
    try {
      const { ops } = await this.api.opsSince(id, this.confirmed()!.rev);
      for (const op of ops) if (op.rev === this.confirmed()!.rev + 1) this.applyConfirmed(op);
    } catch (error) {
      const failure = toApiFailure(error);
      if (failure.status === 410) await this.reloadSnapshot();
      else if (failure.status === 404 || failure.status === 401) this.revoke('revoked');
    }
  }

  private async reloadSnapshot(): Promise<void> {
    const { effectiveRole, ...state } = await this.api.snapshot(this.tierlistId!);
    this.confirmed.set(state);
    this.role.set(effectiveRole);
    this.pending.update((ops) => ops.filter((op) => op.ackRev === null || op.ackRev > state.rev));
  }

  private revoke(reason: 'revoked' | 'deleted'): void {
    this.revokedReason.set(reason);
    this.status.set('revoked');
    this.pending.set([]);
  }

  private close(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    if (this.tierlistId) this.realtime.leave(this.tierlistId);
  }

  // ---- writes (optimistic) ----

  private change<T extends TierlistEventType>(type: T, payload: EventPayload<T>): TierlistEvent {
    const authorId = this.auth.me()?.id ?? null;
    return { tierlistId: this.tierlistId!, rev: 0, clientOpId: null, authorId, type, payload } as TierlistEvent;
  }

  /**
   * Applies `changes` immediately, sends the write, and settles the pending op:
   * confirmed by the HTTP answer or the socket event, rolled back on 4xx, retried on network errors.
   */
  private async perform(changes: TierlistEvent[], send: (clientOpId: string) => Promise<{ rev: number }>): Promise<void> {
    const clientOpId = crypto.randomUUID();
    const op: PendingOp = { clientOpId, changes: changes.map((c) => ({ ...c, clientOpId })), ackRev: null };
    this.pending.update((ops) => [...ops, op]);
    this.notice.set(null);

    for (let attempt = 1; ; attempt++) {
      try {
        const { rev } = await send(clientOpId);
        this.acknowledge(clientOpId, rev);
        return;
      } catch (error) {
        const failure = toApiFailure(error);
        if (failure.status === 0 && attempt < MAX_ATTEMPTS) {
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        this.rollback(clientOpId, failure);
        return;
      }
    }
  }

  private acknowledge(clientOpId: string, rev: number): void {
    const confirmedRev = this.confirmed()?.rev ?? 0;
    if (rev <= confirmedRev) {
      this.pending.update((ops) => ops.filter((op) => op.clientOpId !== clientOpId));
      return;
    }
    this.pending.update((ops) => ops.map((op) => (op.clientOpId === clientOpId ? { ...op, ackRev: rev } : op)));
    setTimeout(() => {
      if (this.status() === 'ready' && (this.confirmed()?.rev ?? 0) < rev) void this.catchUp();
    }, CONFIRM_TIMEOUT_MS);
  }

  private rollback(clientOpId: string, failure: ApiFailure): void {
    this.pending.update((ops) => ops.filter((op) => op.clientOpId !== clientOpId));
    this.notice.set(rejectionMessage(failure));
    // Our view was stale (deleted item, moved anchor): resynchronize.
    if (failure.status === 404 || failure.status === 409) void this.catchUp();
  }

  async moveCard(cardId: string, toCategoryId: string | null, afterCardId: string | null): Promise<void> {
    const view = this.view();
    if (!view) return;
    let position: string;
    try {
      position = positionAfter(cardsIn(view, toCategoryId), afterCardId, cardId);
    } catch {
      return;
    }
    await this.perform([this.change('card.moved', { cardId, categoryId: toCategoryId, position })], (clientOpId) =>
      this.api.moveCard(this.tierlistId!, cardId, { clientOpId, toCategoryId, afterCardId }),
    );
  }

  async createCard(title: string, categoryId: string | null, imageKey: string | null = null): Promise<void> {
    const view = this.view();
    if (!view) return;
    const card: Card = { id: crypto.randomUUID(), title, categoryId, imageKey, position: positionAtEnd(cardsIn(view, categoryId)) };
    await this.perform([this.change('card.created', { card })], (clientOpId) =>
      this.api.createCard(this.tierlistId!, { clientOpId, id: card.id, title, categoryId, imageKey }),
    );
  }

  async updateCard(cardId: string, patch: { title?: string; imageKey?: string | null }): Promise<void> {
    const card = this.view()?.cards.find((c) => c.id === cardId);
    if (!card) return;
    await this.perform([this.change('card.updated', { card: { ...card, ...patch } })], (clientOpId) =>
      this.api.updateCard(this.tierlistId!, cardId, { clientOpId, ...patch }),
    );
  }

  async deleteCard(cardId: string): Promise<void> {
    await this.perform([this.change('card.deleted', { cardId })], (clientOpId) =>
      this.api.deleteCard(this.tierlistId!, cardId, clientOpId),
    );
  }

  async createCategory(name: string, color: string): Promise<void> {
    const view = this.view();
    if (!view) return;
    const categories = sortedCategories(view);
    const afterId = categories.at(-1)?.id ?? null;
    const category: Category = { id: crypto.randomUUID(), name, color, position: positionAfter(categories, afterId) };
    await this.perform([this.change('category.created', { category })], (clientOpId) =>
      this.api.createCategory(this.tierlistId!, { clientOpId, id: category.id, name, color, afterId }),
    );
  }

  async updateCategory(categoryId: string, patch: { name?: string; color?: string }): Promise<void> {
    const category = this.view()?.categories.find((c) => c.id === categoryId);
    if (!category) return;
    await this.perform([this.change('category.updated', { category: { ...category, ...patch } })], (clientOpId) =>
      this.api.updateCategory(this.tierlistId!, categoryId, { clientOpId, ...patch }),
    );
  }

  /** Moves a category one step up or down. */
  async shiftCategory(categoryId: string, direction: -1 | 1): Promise<void> {
    const view = this.view();
    if (!view) return;
    const categories = sortedCategories(view);
    const index = categories.findIndex((c) => c.id === categoryId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const others = categories.filter((c) => c.id !== categoryId);
    const afterId = target === 0 ? null : others[target - 1]!.id;
    const category = { ...categories[index]!, position: positionAfter(categories, afterId, categoryId) };
    await this.perform([this.change('category.updated', { category })], (clientOpId) =>
      this.api.moveCategory(this.tierlistId!, categoryId, { clientOpId, afterId }),
    );
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const view = this.view();
    if (!view) return;
    const cards = cardsIn(view, categoryId);
    const positions = keysBetween(cardsIn(view, null).at(-1)?.position ?? null, null, cards.length);
    const movedCards = cards.map((card, i) => ({ id: card.id, position: positions[i]! }));
    await this.perform([this.change('category.deleted', { categoryId, movedCards })], (clientOpId) =>
      this.api.deleteCategory(this.tierlistId!, categoryId, clientOpId),
    );
  }

  async rename(title: string): Promise<void> {
    await this.perform([this.change('tierlist.updated', { title })], async (clientOpId) =>
      this.api.renameTierlist(this.tierlistId!, { clientOpId, title }),
    );
  }

  dismissNotice(): void {
    this.notice.set(null);
  }
}

/** i18n key explaining why an operation was rolled back. */
function rejectionMessage(failure: ApiFailure): string {
  switch (failure.status) {
    case 0:
      return 'tierlist.offlineRejected';
    case 401:
      return 'error.401.body';
    case 403:
      return 'error.403.body';
    case 404:
    case 409:
      return 'tierlist.staleRejected';
    case 429:
      return 'error.rate_limited';
    default:
      return 'common.genericError';
  }
}
