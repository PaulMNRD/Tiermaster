import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../core/i18n/translate.pipe';

@Component({
  selector: 'tm-loading',
  template: `
    <div class="flex items-center justify-center gap-3 py-12 text-slate-500" role="status" aria-live="polite">
      <span class="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"></span>
      <span>{{ 'common.loading' | t }}</span>
    </div>
  `,
  imports: [TranslatePipe],
})
export class LoadingState {}

@Component({
  selector: 'tm-empty',
  template: `
    <div class="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <div class="text-4xl" aria-hidden="true">{{ icon() }}</div>
      <h2 class="text-lg font-semibold">{{ title() }}</h2>
      @if (body()) {
        <p class="max-w-md text-sm text-slate-500 dark:text-slate-400">{{ body() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('🗂️');
  readonly title = input.required<string>();
  readonly body = input<string>();
}

/** Full-page error for 401 / 403 / 404 / generic failures, with optional retry. */
@Component({
  selector: 'tm-error',
  template: `
    <div class="flex flex-col items-center gap-4 px-4 py-16 text-center" role="alert">
      <div class="text-5xl font-black text-slate-300 dark:text-slate-700">{{ status() || '!' }}</div>
      <h1 class="text-xl font-bold">{{ titleKey() | t }}</h1>
      <p class="max-w-md text-slate-500 dark:text-slate-400">{{ bodyKey() | t }}</p>
      <div class="flex flex-wrap justify-center gap-2">
        @if (status() === 401) {
          <a class="btn-primary" routerLink="/login" [queryParams]="{ returnTo: returnTo() }">{{ 'nav.login' | t }}</a>
        }
        @if (retryable()) {
          <button type="button" class="btn-secondary" (click)="retry.emit()">{{ 'common.retry' | t }}</button>
        }
        <a class="btn-ghost" routerLink="/">{{ 'common.backHome' | t }}</a>
      </div>
    </div>
  `,
  imports: [TranslatePipe, RouterLink],
})
export class ErrorState {
  readonly status = input<number>(0);
  /** `tierlist` shows the "not found or private" wording for 404. */
  readonly variant = input<'page' | 'tierlist'>('page');
  readonly returnTo = input<string>('/');
  readonly retryable = input(false);
  readonly retry = output<void>();

  protected readonly titleKey = computed(() => this.key('title'));
  protected readonly bodyKey = computed(() => this.key('body'));

  private key(part: 'title' | 'body'): string {
    const status = this.status();
    if (status === 404 && this.variant() === 'tierlist') return `error.tierlist.${part}`;
    if (status === 401 || status === 403 || status === 404) return `error.${status}.${part}`;
    return part === 'title' ? 'common.genericError' : '';
  }
}
