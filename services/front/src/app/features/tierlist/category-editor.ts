import { Component, input, output, signal } from '@angular/core';
import type { Category } from '@tiermaster/shared';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Modal } from '../../ui/modal';

export const CATEGORY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8'];

/** Create (no category given) or edit a category: name, color, order, deletion. */
@Component({
  selector: 'tm-category-editor',
  template: `
    <tm-modal [title]="(category() ? 'category.edit' : 'category.add') | t" (closed)="closed.emit()">
      <form class="flex flex-col gap-3" (submit)="save($event)">
        <label class="text-sm font-medium" for="category-name">{{ 'category.name' | t }}</label>
        <input id="category-name" class="input" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="40" required />
        <fieldset>
          <legend class="mb-2 text-sm font-medium">{{ 'category.color' | t }}</legend>
          <div class="flex flex-wrap gap-2">
            @for (option of colors; track option) {
              <button type="button" class="size-9 rounded-full border-2" [style.background]="option"
                      [class.border-slate-900]="color() === option" [class.dark:border-white]="color() === option"
                      [class.border-transparent]="color() !== option" [attr.aria-pressed]="color() === option"
                      [attr.aria-label]="option" (click)="color.set(option)"></button>
            }
          </div>
        </fieldset>
        @if (category()) {
          <div class="flex gap-2">
            <button type="button" class="btn-secondary flex-1" [disabled]="isFirst()" (click)="shift.emit(-1)">↑ {{ 'category.up' | t }}</button>
            <button type="button" class="btn-secondary flex-1" [disabled]="isLast()" (click)="shift.emit(1)">↓ {{ 'category.down' | t }}</button>
          </div>
        }
        <div class="mt-2 flex flex-wrap justify-between gap-2">
          @if (category()) {
            <button type="button" class="btn-danger" (click)="remove.emit()">{{ 'common.delete' | t }}</button>
          } @else {
            <span></span>
          }
          <div class="flex gap-2">
            <button type="button" class="btn-ghost" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn-primary" [disabled]="!name().trim()">{{ 'common.save' | t }}</button>
          </div>
        </div>
      </form>
    </tm-modal>
  `,
  imports: [Modal, TranslatePipe],
})
export class CategoryEditor {
  readonly category = input<Category | null>(null);
  readonly isFirst = input(false);
  readonly isLast = input(false);
  readonly saved = output<{ name: string; color: string }>();
  readonly shift = output<-1 | 1>();
  readonly remove = output<void>();
  readonly closed = output<void>();
  protected readonly colors = CATEGORY_COLORS;
  protected readonly name = signal('');
  protected readonly color = signal(CATEGORY_COLORS[0]!);

  ngOnInit(): void {
    const category = this.category();
    if (category) {
      this.name.set(category.name);
      this.color.set(category.color);
    }
  }

  protected save(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (name) this.saved.emit({ name: name.slice(0, 40), color: this.color() });
  }
}
