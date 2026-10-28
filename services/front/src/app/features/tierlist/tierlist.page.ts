import { Component, effect, inject, input, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RoleBadge } from '../../ui/role-badge';
import { ErrorState, LoadingState } from '../../ui/states';
import { CardTile } from './card-tile';
import { TierlistStore } from './tierlist.store';

@Component({
  template: `
    @switch (store.status()) {
      @case ('loading') {
        <tm-loading />
      }
      @case ('error') {
        <tm-error [status]="store.failure()?.status ?? 0" variant="tierlist" [returnTo]="router.url"
                  [retryable]="(store.failure()?.status ?? 0) >= 500 || store.failure()?.status === 0" (retry)="store.load(id())" />
      }
      @case ('ready') {
        @let view = store.view()!;
        <section class="mx-auto flex max-w-6xl flex-col gap-4 px-2 py-4 sm:px-4">
          <header class="flex flex-wrap items-center gap-2 px-2">
            <h1 class="text-xl font-bold break-words sm:text-2xl">{{ view.title }}</h1>
            @if (store.role(); as role) {
              <tm-role-badge [role]="role" />
            }
            <span class="text-xs text-slate-500">{{ 'visibility.' + (view.defaultRole ?? 'PRIVATE') | t }}</span>
          </header>

          <div class="flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            @for (category of store.categories(); track category.id) {
              <div class="flex min-h-20 border-b border-slate-200 last:border-b-0 sm:min-h-24 dark:border-slate-800">
                <div class="flex w-16 shrink-0 items-center justify-center p-1 text-center text-sm font-bold break-words text-slate-900 sm:w-28 sm:text-base"
                     [style.background]="category.color">
                  {{ category.name }}
                </div>
                <ul class="flex flex-1 flex-wrap content-start gap-1.5 bg-white p-1.5 dark:bg-slate-900" [attr.aria-label]="category.name">
                  @for (card of category.cards; track card.id) {
                    <li><tm-card-tile [card]="card" /></li>
                  }
                </ul>
              </div>
            } @empty {
              <p class="p-4 text-sm text-slate-500">{{ 'tierlist.noCategory' | t }}</p>
            }
          </div>

          <section class="panel p-3">
            <h2 class="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{{ 'tierlist.unsorted' | t }}</h2>
            <ul class="flex min-h-20 flex-wrap content-start gap-1.5" [attr.aria-label]="'tierlist.unsorted' | t">
              @for (card of store.pool(); track card.id) {
                <li><tm-card-tile [card]="card" /></li>
              } @empty {
                <li class="self-center text-sm text-slate-500">{{ 'tierlist.poolEmpty' | t }}</li>
              }
            </ul>
          </section>
        </section>
      }
    }
  `,
  imports: [TranslatePipe, LoadingState, ErrorState, RoleBadge, CardTile],
  providers: [TierlistStore],
})
export default class TierlistPage {
  protected readonly store = inject(TierlistStore);
  protected readonly router = inject(Router);
  readonly id = input.required<string>();

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
  }
}
