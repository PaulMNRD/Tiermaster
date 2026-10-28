import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../core/i18n/translate.pipe';

/** File input styled as a button; `accept="image/*"` also offers the camera on phones. */
@Component({
  selector: 'tm-image-picker',
  template: `
    <label class="btn-secondary cursor-pointer" [class.pointer-events-none]="busy()" [class.opacity-50]="busy()">
      {{ (busy() ? 'image.uploading' : label()) | t }}
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="sr-only" [disabled]="busy()" (change)="pick($event)" />
    </label>
  `,
  imports: [TranslatePipe],
})
export class ImagePicker {
  readonly label = input('image.choose');
  readonly busy = input(false);
  readonly picked = output<File>();

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.picked.emit(file);
  }
}
