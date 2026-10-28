import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { I18nService, LANGS, type Lang } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  template: `
    <div class="flex min-h-dvh flex-col">
      <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <nav class="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-4">
          <a routerLink="/" class="mr-2 flex items-center gap-2 font-black tracking-tight">
            <span class="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">TM</span>
            <span class="hidden sm:inline">{{ 'app.name' | t }}</span>
          </a>
          @if (auth.isSignedIn()) {
            <a routerLink="/" routerLinkActive="bg-slate-200 dark:bg-slate-800" [routerLinkActiveOptions]="{ exact: true }"
               class="btn-ghost px-3">{{ 'nav.home' | t }}</a>
          }
          <a routerLink="/community" routerLinkActive="bg-slate-200 dark:bg-slate-800" class="btn-ghost px-3">{{ 'nav.community' | t }}</a>
          <span class="flex-1"></span>
          <select class="input w-auto min-h-9 py-1" [attr.aria-label]="'lang.switch' | t"
                  [value]="i18n.lang()" (change)="setLang($any($event.target).value)">
            @for (lang of langs; track lang) {
              <option [value]="lang">{{ lang.toUpperCase() }}</option>
            }
          </select>
          <button type="button" class="btn-ghost px-2" (click)="theme.toggle()" [attr.aria-label]="'theme.toggle' | t">
            {{ theme.theme() === 'dark' ? '☀️' : '🌙' }}
          </button>
          @if (auth.me(); as me) {
            <div class="relative">
              <button type="button" class="btn-ghost px-2" (click)="menuOpen.set(!menuOpen())"
                      [attr.aria-expanded]="menuOpen()" [attr.aria-label]="'nav.menu' | t">
                @if (me.avatarUrl) {
                  <img [src]="me.avatarUrl" alt="" class="size-7 rounded-full object-cover" />
                } @else {
                  <span class="grid size-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {{ (me.name ?? '?').slice(0, 1).toUpperCase() }}
                  </span>
                }
                <span class="hidden max-w-32 truncate sm:inline">{{ me.name }}</span>
              </button>
              @if (menuOpen()) {
                <div class="panel absolute right-0 mt-1 flex w-44 flex-col p-1" (click)="menuOpen.set(false)">
                  <a routerLink="/profile" class="btn-ghost justify-start">{{ 'nav.profile' | t }}</a>
                  <button type="button" class="btn-ghost justify-start" (click)="logout()">{{ 'nav.logout' | t }}</button>
                </div>
              }
            </div>
          } @else if (auth.me() === null) {
            <a routerLink="/login" class="btn-primary px-3">{{ 'nav.login' | t }}</a>
          }
        </nav>
      </header>
      <main class="flex-1">
        <router-outlet />
      </main>
    </div>
  `,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  protected readonly langs = LANGS;
  protected readonly menuOpen = signal(false);

  constructor() {
    void this.auth.ensureLoaded();
  }

  protected setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
