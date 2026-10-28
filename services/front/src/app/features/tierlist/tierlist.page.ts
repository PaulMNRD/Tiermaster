import { CdkDrag, type CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { cardsIn, CardTitleSchema, TierlistTitleSchema } from '@tiermaster/shared';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConnectionIndicator } from '../../ui/connection-indicator';
import { RoleBadge } from '../../ui/role-badge';
import { ErrorState, LoadingState } from '../../ui/states';
import { CardEditor, type CardEdit } from './card-editor';
import { CardTile } from './card-tile';
import { CategoryEditor } from './category-editor';
import { TierlistStore } from './tierlist.store';

/** Drop-list id of the unsorted pool (category lists use the category id). */
const POOL = 'pool';

@Component({
  template: `
    @switch (store.status()) {
      @case ('loading') {
        <tm-loading />
      }
      @case ('error') {
        <tm-error [status]="store.failure()?.status ?? 0" variant="tierlist" [returnTo]="router.url"
                  [retryable]="(store.failure()?.status ?? 0) >= 500 || store.failure()?.status === 0" (retry)="store.load(id())" />
      }
      @case ('revoked') {
        <div class="flex flex-col items-center gap-4 px-4 py-16 text-center" role="alert">
          <div class="text-5xl" aria-hidden="true">🔒</div>
          <h1 class="text-xl font-bold">{{ (store.revokedReason() === 'deleted' ? 'tierlist.deletedTitle' : 'tierlist.revokedTitle') | t }}</h1>
          <p class="max-w-md text-slate-500 dark:text-slate-400">{{ 'tierlist.revokedBody' | t }}</p>
          <a class="btn-primary" routerLink="/">{{ 'common.backHome' | t }}</a>
        </div>
      }
      @case ('ready') {
        @let view = store.view()!;
        <section class="mx-auto flex max-w-6xl flex-col gap-4 px-2 py-4 sm:px-4" cdkDropListGroup>
          <header class="flex flex-wrap items-center gap-x-3 gap-y-2 px-2">
            @if (editingTitle()) {
              <form class="flex flex-1 gap-2" (submit)="saveTitle($event)">
                <input class="input text-lg font-bold" [value]="view.title" maxlength="100" [attr.aria-label]="'tierlist.title' | t"
                       (keydown.escape)="editingTitle.set(false)" />
                <button class="btn-primary" type="submit">{{ 'common.save' | t }}</button>
              </form>
            } @else {
              <h1 class="text-xl font-bold break-words sm:text-2xl">{{ view.title }}</h1>
              @if (store.canRename()) {
                <button type="button" class="btn-ghost px-2 text-sm" (click)="editingTitle.set(true)" [attr.aria-label]="'tierlist.rename' | t">✏️</button>
              }
            }
            @if (store.role(); as role) {
              <tm-role-badge [role]="role" />
            }
            <span class="text-xs text-slate-500">{{ 'visibility.' + (view.defaultRole ?? 'PRIVATE') | t }}</span>
            <span class="flex-1"></span>
            <tm-connection-indicator />
            @if (showSettings()) {
              <a class="btn-secondary px-3" [routerLink]="['/t', view.id, 'settings']">{{ 'tierlist.settings' | t }}</a>
            }
          </header>

          @if (store.notice(); as notice) {
            <div class="flex items-start justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200" role="alert">
              <span>{{ notice | t }}</span>
              <button type="button" class="underline" (click)="store.dismissNotice()">{{ 'common.close' | t }}</button>
            </div>
          }
          @if (!store.canEdit()) {
            <p class="px-2 text-xs text-slate-500">{{ 'tierlist.readOnly' | t }}</p>
          }

          <div class="flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            @for (category of store.categories(); track category.id; let first = $first; let last = $last) {
              <div class="flex min-h-20 border-b border-slate-200 last:border-b-0 sm:min-h-24 dark:border-slate-800">
                <button type="button" class="flex w-16 shrink-0 items-center justify-center p-1 text-center text-sm font-bold break-words text-slate-900 sm:w-28 sm:text-base"
                        [style.background]="category.color" [disabled]="!store.canEditCategories()"
                        (click)="editCategory.set({ id: category.id, first, last })" [attr.aria-label]="('category.edit' | t) + ' ' + category.name">
                  {{ category.name }}
                </button>
                <ul class="flex flex-1 flex-wrap content-start gap-1.5 bg-white p-1.5 dark:bg-slate-900" [attr.aria-label]="category.name"
                    cdkDropList cdkDropListOrientation="mixed" [cdkDropListData]="category.id" [cdkDropListDisabled]="!store.canEdit()"
                    (cdkDropListDropped)="drop($event)">
                  @for (card of category.cards; track card.id) {
                    <li cdkDrag [cdkDragData]="card.id" [cdkDragStartDelay]="dragDelay" class="cursor-grab touch-manipulation">
                      <tm-card-tile [card]="card" (click)="openCard(card.id)" />
                    </li>
                  }
                </ul>
              </div>
            } @empty {
              <p class="p-4 text-sm text-slate-500">{{ 'tierlist.noCategory' | t }}</p>
            }
          </div>
          @if (store.canEditCategories()) {
            <button type="button" class="btn-secondary self-start" (click)="addingCategory.set(true)">＋ {{ 'category.add' | t }}</button>
          }

          <section class="panel p-3">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-sm font-semibold text-slate-600 dark:text-slate-300">{{ 'tierlist.unsorted' | t }}</h2>
              @if (store.canEdit()) {
                <form class="flex gap-2" (submit)="addCard($event)">
                  <input class="input min-h-9 py-1 sm:w-56" [placeholder]="'card.newPlaceholder' | t" [attr.aria-label]="'card.newPlaceholder' | t"
                         [value]="newCard()" (input)="newCard.set($any($event.target).value)" maxlength="80" />
                  <button class="btn-primary min-h-9 shrink-0 py-1" type="submit" [disabled]="!newCard().trim()">{{ 'card.add' | t }}</button>
                </form>
              }
            </div>
            <ul class="flex min-h-20 flex-wrap content-start gap-1.5" [attr.aria-label]="'tierlist.unsorted' | t"
                cdkDropList cdkDropListOrientation="mixed" [cdkDropListData]="pool" [cdkDropListDisabled]="!store.canEdit()"
                (cdkDropListDropped)="drop($event)">
              @for (card of store.pool(); track card.id) {
                <li cdkDrag [cdkDragData]="card.id" [cdkDragStartDelay]="dragDelay" class="cursor-grab touch-manipulation">
                  <tm-card-tile [card]="card" (click)="openCard(card.id)" />
                </li>
              } @empty {
                <li class="self-center text-sm text-slate-500">{{ 'tierlist.poolEmpty' | t }}</li>
              }
            </ul>
          </section>
        </section>

        @if (editedCard(); as card) {
          <tm-card-editor [card]="card" (saved)="saveCard(card.id, $event)" (remove)="removeCard(card.id)" (closed)="editCardId.set(null)" />
        }
        @if (editCategory(); as edit) {
          @if (categoryById(edit.id); as category) {
            <tm-category-editor [category]="category" [isFirst]="edit.first" [isLast]="edit.last"
                                (saved)="store.updateCategory(category.id, $event); editCategory.set(null)"
                                (shift)="shiftCategory(category.id, $event)"
                                (remove)="store.deleteCategory(category.id); editCategory.set(null)"
                                (closed)="editCategory.set(null)" />
          }
        }
        @if (addingCategory()) {
          <tm-category-editor (saved)="store.createCategory($event.name, $event.color); addingCategory.set(false)" (closed)="addingCategory.set(false)" />
        }
      }
    }
  `,
  imports: [
    TranslatePipe,
    LoadingState,
    ErrorState,
    RoleBadge,
    CardTile,
    CardEditor,
    CategoryEditor,
    ConnectionIndicator,
    RouterLink,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
  ],
  providers: [TierlistStore],
})
export default class TierlistPage {
  protected readonly store = inject(TierlistStore);
  protected readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly id = input.required<string>();

  protected readonly pool = POOL;
  /** Touch needs a short press before dragging, so the page still scrolls on phones. */
  protected readonly dragDelay = { touch: 180, mouse: 0 };
  protected readonly newCard = signal('');
  protected readonly editingTitle = signal(false);
  protected readonly editCardId = signal<string | null>(null);
  protected readonly editCategory = signal<{ id: string; first: boolean; last: boolean } | null>(null);
  protected readonly addingCategory = signal(false);

  protected readonly editedCard = computed(() => {
    const id = this.editCardId();
    return id ? (this.store.view()?.cards.find((c) => c.id === id) ?? null) : null;
  });
  /** Settings hold sharing, leaving and deletion: useful to any signed-in user with a role. */
  protected readonly showSettings = computed(() => this.auth.isSignedIn() && this.store.role() !== null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
  }

  protected categoryById(id: string) {
    return this.store.view()?.categories.find((c) => c.id === id) ?? null;
  }

  protected drop(event: CdkDragDrop<string>): void {
    const cardId = event.item.data as string;
    const toCategoryId = event.container.data === POOL ? null : event.container.data;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    const others = cardsIn(this.store.view()!, toCategoryId).filter((c) => c.id !== cardId);
    const afterCardId = event.currentIndex === 0 ? null : (others[event.currentIndex - 1]?.id ?? others.at(-1)?.id ?? null);
    void this.store.moveCard(cardId, toCategoryId, afterCardId);
  }

  protected openCard(cardId: string): void {
    if (this.store.canEdit()) this.editCardId.set(cardId);
  }

  protected addCard(event: Event): void {
    event.preventDefault();
    const title = CardTitleSchema.safeParse(this.newCard());
    if (!title.success) return;
    void this.store.createCard(title.data, null);
    this.newCard.set('');
  }

  protected saveCard(cardId: string, edit: CardEdit): void {
    void this.store.updateCard(cardId, edit);
    this.editCardId.set(null);
  }

  protected removeCard(cardId: string): void {
    void this.store.deleteCard(cardId);
    this.editCardId.set(null);
  }

  protected shiftCategory(categoryId: string, direction: -1 | 1): void {
    void this.store.shiftCategory(categoryId, direction);
    const ids = this.store.categories().map((c) => c.id);
    const index = ids.indexOf(categoryId);
    this.editCategory.set({ id: categoryId, first: index === 0, last: index === ids.length - 1 });
  }

  protected saveTitle(event: Event): void {
    event.preventDefault();
    const input = (event.target as HTMLFormElement).querySelector('input')!;
    const title = TierlistTitleSchema.safeParse(input.value);
    if (title.success && title.data !== this.store.view()?.title) void this.store.rename(title.data);
    this.editingTitle.set(false);
  }
}
