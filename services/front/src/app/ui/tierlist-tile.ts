import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { TierlistSummary } from '@tiermaster/shared';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { RoleBadge } from './role-badge';

@Component({
  selector: 'tm-tierlist-tile',
  template: `
    @let t = tierlist();
    <a [routerLink]="['/t', t.id]" class="panel flex h-full flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div class="flex items-start justify-between gap-2">
        <h3 class="line-clamp-2 font-semibold break-words">{{ t.title }}</h3>
        @if (t.role) {
          <tm-role-badge [role]="t.role" />
        }
      </div>
      <div class="flex gap-1" aria-hidden="true">
        @for (color of colors; track color) {
          <span class="h-1.5 flex-1 rounded-full" [style.background]="color"></span>
        }
      </div>
      <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>{{ 'tile.by' | t: { name: t.owner.name ?? '?' } }}</span>
        <span>{{ 'tile.cards' | t: { count: t.cardCount } }}</span>
        <span>{{ 'visibility.' + (t.defaultRole ?? 'PRIVATE') | t }}</span>
      </div>
    </a>
  `,
  imports: [RouterLink, TranslatePipe, RoleBadge],
})
export class TierlistTile {
  readonly tierlist = input.required<TierlistSummary>();
  protected readonly colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
}
