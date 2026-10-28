import { Component, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TierlistTitleSchema, type TierlistSort } from '@tiermaster/shared';
import { toApiFailure } from '../../core/api/api-error';
import { TierlistsApi } from '../../core/api/tierlists.api';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SearchBar } from '../../ui/search-bar';
import { EmptyState, ErrorState, LoadingState } from '../../ui/states';
import { TierlistTile } from '../../ui/tierlist-tile';

@Component({
  template: `
    <section class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 class="text-2xl font-bold">{{ 'nav.home' | t }}</h1>
        <form class="flex gap-2" (submit)="create($event)">
          <input class="input sm:w-64" name="title" [placeholder]="'home.newPlaceholder' | t" [attr.aria-label]="'home.newPlaceholder' | t"
                 [value]="newTitle()" (input)="newTitle.set($any($event.target).value)" maxlength="100" />
          <button class="btn-primary shrink-0" type="submit" [disabled]="creating() || !newTitle().trim()">{{ 'home.create' | t }}</button>
        </form>
      </header>
      @if (createError()) {
        <p class="text-sm text-red-600" role="alert">{{ createError()! | t }}</p>
      }

      <tm-search-bar placeholder="home.searchPlaceholder" [(q)]="q" [(sort)]="sort" />

      @if (list.isLoading() && !list.hasValue()) {
        <tm-loading />
      } @else if (list.error()) {
        <tm-error [status]="failureStatus()" [retryable]="true" (retry)="list.reload()" />
      } @else if (list.value()?.length === 0) {
        <tm-empty icon="🏆" [title]="(q() ? 'home.noResult' : 'home.emptyTitle') | t" [body]="q() ? undefined : ('home.emptyBody' | t)" />
      } @else {
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (tierlist of list.value(); track tierlist.id) {
            <li><tm-tierlist-tile [tierlist]="tierlist" /></li>
          }
        </ul>
      }
    </section>
  `,
  imports: [TranslatePipe, SearchBar, TierlistTile, LoadingState, ErrorState, EmptyState],
})
export default class HomePage {
  private readonly api = inject(TierlistsApi);
  private readonly router = inject(Router);

  protected readonly q = signal('');
  protected readonly sort = signal<TierlistSort>('updated');
  protected readonly newTitle = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly list = resource({
    params: () => ({ q: this.q(), sort: this.sort() }),
    loader: ({ params }) => this.api.listMine(params),
  });

  protected failureStatus(): number {
    return toApiFailure(this.list.error()).status;
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    const title = TierlistTitleSchema.safeParse(this.newTitle());
    if (!title.success) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      const created = await this.api.create({ title: title.data, defaultRole: null });
      await this.router.navigate(['/t', created.id]);
    } catch {
      this.createError.set('common.genericError');
    } finally {
      this.creating.set(false);
    }
  }
}
