import { Component, input, output, signal } from '@angular/core';
import { type Card, CardTitleSchema } from '@tiermaster/shared';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Modal } from '../../ui/modal';

export interface CardEdit {
  title: string;
}

@Component({
  selector: 'tm-card-editor',
  template: `
    <tm-modal [title]="'card.edit' | t" (closed)="closed.emit()">
      <form class="flex flex-col gap-3" (submit)="save($event)">
        <label class="text-sm font-medium" for="card-title">{{ 'card.title' | t }}</label>
        <input id="card-title" class="input" [value]="title()" (input)="title.set($any($event.target).value)" maxlength="80" required />
        <ng-content />
        <div class="mt-2 flex flex-wrap justify-between gap-2">
          <button type="button" class="btn-danger" (click)="remove.emit()">{{ 'common.delete' | t }}</button>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn-primary" [disabled]="!valid()">{{ 'common.save' | t }}</button>
          </div>
        </div>
      </form>
    </tm-modal>
  `,
  imports: [Modal, TranslatePipe],
})
export class CardEditor {
  readonly card = input.required<Card>();
  readonly saved = output<CardEdit>();
  readonly remove = output<void>();
  readonly closed = output<void>();
  protected readonly title = signal('');

  ngOnInit(): void {
    this.title.set(this.card().title);
  }

  protected valid(): boolean {
    return CardTitleSchema.safeParse(this.title()).success;
  }

  protected save(event: Event): void {
    event.preventDefault();
    const title = CardTitleSchema.safeParse(this.title());
    if (title.success) this.saved.emit({ title: title.data });
  }
}
