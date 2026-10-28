import { Component, computed, input } from '@angular/core';
import type { Card } from '@tiermaster/shared';

/** A card: its image when it has one, its title otherwise (title always available to assistive tech). */
@Component({
  selector: 'tm-card-tile',
  host: { class: 'block' },
  template: `
    @let c = card();
    <div class="relative flex size-16 select-none items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-white text-center shadow-sm sm:size-20 dark:border-slate-700 dark:bg-slate-800"
         [title]="c.title" [class.ring-2]="highlighted()" [class.ring-brand-500]="highlighted()">
      @if (imageUrl(); as src) {
        <img [src]="src" [alt]="c.title" class="size-full object-cover" loading="lazy" draggable="false" />
        <span class="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[10px] text-white">{{ c.title }}</span>
      } @else {
        <span class="line-clamp-3 px-1 text-xs font-medium break-words">{{ c.title }}</span>
      }
    </div>
  `,
})
export class CardTile {
  readonly card = input.required<Card>();
  readonly highlighted = input(false);
  protected readonly imageUrl = computed(() => {
    const key = this.card().imageKey;
    return key ? `/api/media/${key}` : null;
  });
}
