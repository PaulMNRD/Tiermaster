import { Component, computed, inject, resource, signal } from '@angular/core';
import type { TierlistSort } from '@tiermaster/shared';
import { toApiFailure } from '../../core/api/api-error';
import { TierlistsApi } from '../../core/api/tierlists.api';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SearchBar } from '../../ui/search-bar';
import { EmptyState, ErrorState, LoadingState } from '../../ui/states';
import { TierlistTile } from '../../ui/tierlist-tile';

const PAGE_SIZE = 12;

@Component({
  template: `
    <section class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 class="text-2xl font-bold">{{ 'nav.community' | t }}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ 'community.subtitle' | t }}</p>
      </header>
      <tm-search-bar placeholder="community.searchPlaceholder" [(q)]="q" [(sort)]="sort" (changed)="page.set(1)" />

      @if (result.isLoading() && !result.hasValue()) {
        <tm-loading />
      } @else if (result.error()) {
        <tm-error [status]="failureStatus()" [retryable]="true" (retry)="result.reload()" />
      } @else if (result.value()?.items?.length === 0) {
        <tm-empty icon="🌍" [title]="'community.empty' | t" />
      } @else if (result.value(); as data) {
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" [class.opacity-60]="result.isLoading()">
          @for (tierlist of data.items; track tierlist.id) {
            <li><tm-tierlist-tile [tierlist]="tierlist" /></li>
          }
        </ul>
        <nav class="flex items-center justify-center gap-3" [attr.aria-label]="'community.pagination' | t">
          <button type="button" class="btn-secondary" [disabled]="page() <= 1" (click)="page.set(page() - 1)">{{ 'common.previous' | t }}</button>
          <span class="text-sm text-slate-500">{{ 'community.page' | t: { page: page(), pages: pages() } }}</span>
          <button type="button" class="btn-secondary" [disabled]="page() >= pages()" (click)="page.set(page() + 1)">{{ 'common.next' | t }}</button>
        </nav>
      }
    </section>
  `,
  imports: [TranslatePipe, SearchBar, TierlistTile, LoadingState, ErrorState, EmptyState],
})
export default class CommunityPage {
  private readonly api = inject(TierlistsApi);

  protected readonly q = signal('');
  protected readonly sort = signal<TierlistSort>('updated');
  protected readonly page = signal(1);

  protected readonly result = resource({
    params: () => ({ q: this.q(), sort: this.sort(), page: this.page(), pageSize: PAGE_SIZE }),
    loader: ({ params }) => this.api.community(params),
  });
  protected readonly pages = computed(() => Math.max(1, Math.ceil((this.result.value()?.total ?? 0) / PAGE_SIZE)));

  protected failureStatus(): number {
    return toApiFailure(this.result.error()).status;
  }
}
