import { Component, ElementRef, afterNextRender, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../core/i18n/translate.pipe';

/** Accessible dialog: bottom sheet on phones, centered panel on larger screens. Closes on Escape and backdrop click. */
@Component({
  selector: 'tm-modal',
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" (click)="closed.emit()">
      <div class="panel max-h-[90dvh] w-full overflow-y-auto rounded-b-none p-4 sm:max-w-md sm:rounded-xl"
           role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()" tabindex="-1">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">{{ title() }}</h2>
          <button type="button" class="btn-ghost px-2" (click)="closed.emit()" [attr.aria-label]="'common.close' | t">✕</button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
  imports: [TranslatePipe],
})
export class Modal {
  readonly title = input.required<string>();
  readonly closed = output<void>();
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    afterNextRender(() => {
      const target = this.host.nativeElement.querySelector('input, textarea, select, [role="dialog"]') as HTMLElement | null;
      target?.focus();
    });
  }
}
