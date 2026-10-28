import { Component, computed, inject, input, output, signal } from '@angular/core';
import { type Card, CardTitleSchema } from '@tiermaster/shared';
import { toApiFailure } from '../../core/api/api-error';
import { MediaApi } from '../../core/api/media.api';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ImagePicker } from '../../ui/image-picker';
import { Modal } from '../../ui/modal';

export interface CardEdit {
  title?: string;
  imageKey?: string | null;
}

@Component({
  selector: 'tm-card-editor',
  template: `
    <tm-modal [title]="'card.edit' | t" (closed)="closed.emit()">
      <form class="flex flex-col gap-3" (submit)="save($event)">
        <label class="text-sm font-medium" for="card-title">{{ 'card.title' | t }}</label>
        <input id="card-title" class="input" [value]="title()" (input)="title.set($any($event.target).value)" maxlength="80" required />

        <div class="flex items-center gap-3">
          <div class="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            @if (imageUrl(); as src) {
              <img [src]="src" alt="" class="size-full object-cover" />
            } @else {
              <span class="text-2xl" aria-hidden="true">🖼️</span>
            }
          </div>
          <div class="flex flex-wrap gap-2">
            <tm-image-picker [busy]="uploading()" (picked)="upload($event)" />
            @if (imageKey()) {
              <button type="button" class="btn-ghost" (click)="imageKey.set(null)">{{ 'image.remove' | t }}</button>
            }
          </div>
        </div>
        @if (error()) {
          <p class="text-sm text-red-600" role="alert">{{ error()! | t }}</p>
        }

        <div class="mt-2 flex flex-wrap justify-between gap-2">
          <button type="button" class="btn-danger" (click)="remove.emit()">{{ 'common.delete' | t }}</button>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn-primary" [disabled]="!valid() || uploading()">{{ 'common.save' | t }}</button>
          </div>
        </div>
      </form>
    </tm-modal>
  `,
  imports: [Modal, TranslatePipe, ImagePicker],
})
export class CardEditor {
  private readonly media = inject(MediaApi);
  readonly card = input.required<Card>();
  readonly tierlistId = input.required<string>();
  readonly saved = output<CardEdit>();
  readonly remove = output<void>();
  readonly closed = output<void>();
  protected readonly title = signal('');
  protected readonly imageKey = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly imageUrl = computed(() => (this.imageKey() ? `/api/media/${this.imageKey()}` : null));

  ngOnInit(): void {
    this.title.set(this.card().title);
    this.imageKey.set(this.card().imageKey);
  }

  protected valid(): boolean {
    return CardTitleSchema.safeParse(this.title()).success;
  }

  protected async upload(file: File): Promise<void> {
    this.uploading.set(true);
    this.error.set(null);
    try {
      this.imageKey.set(await this.media.uploadCardImage(this.tierlistId(), file));
    } catch (error) {
      this.error.set(uploadError(toApiFailure(error).status));
    } finally {
      this.uploading.set(false);
    }
  }

  protected save(event: Event): void {
    event.preventDefault();
    const title = CardTitleSchema.safeParse(this.title());
    if (!title.success) return;
    const edit: CardEdit = {};
    if (title.data !== this.card().title) edit.title = title.data;
    if (this.imageKey() !== this.card().imageKey) edit.imageKey = this.imageKey();
    this.saved.emit(edit);
  }
}

export function uploadError(status: number): string {
  if (status === 413) return 'image.tooLarge';
  if (status === 415) return 'image.unsupported';
  if (status === 403) return 'error.403.body';
  return 'common.genericError';
}
