import { Component, input, model, output } from '@angular/core';
import type { TierlistSort } from '@tiermaster/shared';
import { TranslatePipe } from '../core/i18n/translate.pipe';

/** Search box (debounced) and sort picker shared by the home and community pages. */
@Component({
  selector: 'tm-search-bar',
  template: `
    <div class="flex flex-col gap-2 sm:flex-row">
      <input type="search" class="input sm:flex-1" [placeholder]="placeholder() | t" [attr.aria-label]="'common.search' | t"
             [value]="q()" (input)="onInput($any($event.target).value)" maxlength="100" />
      <select class="input sm:w-48" [attr.aria-label]="'sort.label' | t" [value]="sort()" (change)="sortChange($any($event.target).value)">
        <option value="updated">{{ 'sort.updated' | t }}</option>
        <option value="created">{{ 'sort.created' | t }}</option>
        <option value="title">{{ 'sort.title' | t }}</option>
      </select>
    </div>
  `,
  imports: [TranslatePipe],
})
export class SearchBar {
  readonly placeholder = input('common.search');
  readonly q = model('');
  readonly sort = model<TierlistSort>('updated');
  readonly changed = output<void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected onInput(value: string): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q.set(value.trim());
      this.changed.emit();
    }, 250);
  }

  protected sortChange(value: TierlistSort): void {
    this.sort.set(value);
    this.changed.emit();
  }
}
