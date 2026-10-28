import { Component, computed, inject, input, signal } from '@angular/core';
import type { AuthProviderId } from '@tiermaster/shared';
import { safeReturnTo } from '../../core/auth/auth.guards';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LoadingState } from '../../ui/states';

const PROVIDER_LABELS: Record<AuthProviderId, string> = { google: 'Google', discord: 'Discord', steam: 'Steam', fake: 'Dev' };

@Component({
  template: `
    <section class="mx-auto flex max-w-sm flex-col gap-6 px-4 py-12">
      <header class="text-center">
        <h1 class="text-2xl font-bold">{{ 'login.title' | t }}</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ 'login.subtitle' | t }}</p>
      </header>
      @if (errorKey(); as key) {
        <p class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">{{ key | t }}</p>
      }
      @if (providers() === null) {
        <tm-loading />
      } @else {
        <div class="flex flex-col gap-3">
          @for (provider of oauthProviders(); track provider) {
            <a class="btn-secondary w-full" [href]="auth.loginUrl(provider, target())">
              {{ 'login.with' | t: { provider: label(provider) } }}
            </a>
          }
        </div>
        @if (providers()!.includes('fake')) {
          <form class="panel flex flex-col gap-3 p-4" (submit)="devLogin($event)">
            <h2 class="text-sm font-semibold">{{ 'login.devTitle' | t }}</h2>
            <input class="input" name="hint" [placeholder]="'login.devHint' | t" [value]="hint()"
                   (input)="hint.set($any($event.target).value)" autocomplete="username" />
            <button class="btn-primary" type="submit">{{ 'login.devSubmit' | t }}</button>
          </form>
        }
        @if (providers()!.length === 0) {
          <p class="text-center text-sm text-slate-500">{{ 'login.noProvider' | t }}</p>
        }
      }
    </section>
  `,
  imports: [TranslatePipe, LoadingState],
})
export default class LoginPage {
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  readonly returnTo = input<string>();
  readonly error = input<string>();

  protected readonly providers = signal<AuthProviderId[] | null>(null);
  protected readonly hint = signal('alice');
  protected readonly target = computed(() => safeReturnTo(this.returnTo()));
  protected readonly oauthProviders = computed(() => (this.providers() ?? []).filter((p) => p !== 'fake'));
  protected readonly errorKey = computed(() => {
    const error = this.error();
    if (!error) return null;
    const key = `login.error.${error}`;
    return this.i18n.has(key) ? key : 'common.genericError';
  });

  constructor() {
    this.auth.providers().then(
      (providers) => this.providers.set(providers),
      () => this.providers.set([]),
    );
  }

  protected label(provider: AuthProviderId): string {
    return PROVIDER_LABELS[provider];
  }

  protected devLogin(event: Event): void {
    event.preventDefault();
    window.location.assign(this.auth.loginUrl('fake', this.target(), this.hint().trim().toLowerCase()));
  }
}
