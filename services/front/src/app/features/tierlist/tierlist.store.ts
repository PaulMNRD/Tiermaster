import { Injectable, computed, inject, signal } from '@angular/core';
import { type Role, sortedCategories, cardsIn, type TierlistState } from '@tiermaster/shared';
import { type ApiFailure, toApiFailure } from '../../core/api/api-error';
import { ContentApi } from '../../core/api/content.api';

export type LoadStatus = 'loading' | 'ready' | 'error';

/** State of the open tierlist (one instance per tierlist page). */
@Injectable()
export class TierlistStore {
  private readonly api = inject(ContentApi);

  readonly status = signal<LoadStatus>('loading');
  readonly failure = signal<ApiFailure | null>(null);
  /** Last state confirmed by the server. */
  readonly confirmed = signal<TierlistState | null>(null);
  readonly role = signal<Role | null>(null);

  /** What the UI renders. */
  readonly view = computed(() => this.confirmed());
  readonly categories = computed(() => {
    const view = this.view();
    return view ? sortedCategories(view).map((category) => ({ ...category, cards: cardsIn(view, category.id) })) : [];
  });
  readonly pool = computed(() => {
    const view = this.view();
    return view ? cardsIn(view, null) : [];
  });

  private tierlistId: string | null = null;

  async load(id: string): Promise<void> {
    this.tierlistId = id;
    this.status.set('loading');
    try {
      const { effectiveRole, ...state } = await this.api.snapshot(id);
      if (this.tierlistId !== id) return;
      this.confirmed.set(state);
      this.role.set(effectiveRole);
      this.status.set('ready');
    } catch (error) {
      this.failure.set(toApiFailure(error));
      this.status.set('error');
    }
  }
}
