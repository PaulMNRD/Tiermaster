import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { PseudonymSchema } from '@tiermaster/shared';
import { firstValueFrom } from 'rxjs';
import { toApiFailure } from '../../core/api/api-error';
import { MediaApi } from '../../core/api/media.api';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ImagePicker } from '../../ui/image-picker';
import { uploadError } from '../tierlist/card-editor';

/** Profile: pseudonym, avatar, account deletion. */
@Component({
  template: `
    @if (auth.me(); as me) {
      <section class="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
        <h1 class="text-2xl font-bold">{{ 'nav.profile' | t }}</h1>
        @if (message(); as m) {
          <p class="rounded-lg p-3 text-sm" role="status"
             [class]="m.error ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'">
            {{ m.key | t }}
          </p>
        }

        <section class="panel flex items-center gap-4 p-4">
          @if (me.avatarUrl) {
            <img [src]="me.avatarUrl" alt="" class="size-20 rounded-full object-cover" />
          } @else {
            <span class="grid size-20 place-items-center rounded-full bg-brand-100 text-3xl font-bold text-brand-700">{{ (me.name ?? '?').slice(0, 1).toUpperCase() }}</span>
          }
          <div class="flex flex-wrap gap-2">
            <tm-image-picker label="profile.changeAvatar" [busy]="busy()" (picked)="uploadAvatar($event)" />
            @if (me.avatarUrl) {
              <button type="button" class="btn-ghost" [disabled]="busy()" (click)="removeAvatar()">{{ 'image.remove' | t }}</button>
            }
          </div>
        </section>

        <form class="panel flex flex-col gap-3 p-4" (submit)="rename($event)">
          <label class="text-sm font-medium" for="profile-name">{{ 'welcome.label' | t }}</label>
          <div class="flex gap-2">
            <input id="profile-name" name="name" class="input" [value]="me.name" maxlength="24" autocomplete="nickname" />
            <button class="btn-primary shrink-0" type="submit" [disabled]="busy()">{{ 'common.save' | t }}</button>
          </div>
          <p class="text-xs text-slate-500">{{ 'welcome.hint' | t }}</p>
          @if (me.email) {
            <p class="text-xs text-slate-500">{{ 'profile.email' | t: { email: me.email } }}</p>
          }
        </form>

        <section class="panel flex flex-col gap-3 border-red-300 p-4 dark:border-red-900">
          <h2 class="font-semibold text-red-700 dark:text-red-400">{{ 'profile.deleteTitle' | t }}</h2>
          <p class="text-sm">{{ 'profile.deleteHelp' | t }}</p>
          <label class="text-sm" for="profile-confirm">{{ 'profile.deleteConfirm' | t: { name: me.name ?? '' } }}</label>
          <div class="flex gap-2">
            <input id="profile-confirm" class="input" [value]="confirmation()" (input)="confirmation.set($any($event.target).value)" autocomplete="off" />
            <button type="button" class="btn-danger shrink-0" [disabled]="confirmation() !== me.name || busy()" (click)="deleteAccount()">
              {{ 'profile.delete' | t }}
            </button>
          </div>
        </section>
      </section>
    }
  `,
  imports: [TranslatePipe, ImagePicker],
})
export default class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly media = inject(MediaApi);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly confirmation = signal('');
  protected readonly message = signal<{ key: string; error: boolean } | null>(null);

  private async run(action: () => Promise<unknown>, onError: (status: number, code: string) => string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      await this.auth.reload();
      this.message.set({ key: 'settings.saved', error: false });
    } catch (error) {
      const failure = toApiFailure(error);
      this.message.set({ key: onError(failure.status, failure.code), error: true });
    } finally {
      this.busy.set(false);
    }
  }

  protected rename(event: Event): void {
    event.preventDefault();
    const name = PseudonymSchema.safeParse(new FormData(event.target as HTMLFormElement).get('name'));
    if (!name.success) {
      this.message.set({ key: 'error.pseudonym_invalid', error: true });
      return;
    }
    void this.run(
      () => this.auth.setPseudonym(name.data),
      (_, code) => (code === 'pseudonym_taken' ? 'error.pseudonym_taken' : 'common.genericError'),
    );
  }

  protected uploadAvatar(file: File): void {
    void this.run(() => this.media.uploadAvatar(file), (status) => uploadError(status));
  }

  protected removeAvatar(): void {
    void this.run(() => this.media.removeAvatar(), () => 'common.genericError');
  }

  protected async deleteAccount(): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.http.delete('/api/me'));
      this.auth.me.set(null);
      await this.router.navigateByUrl('/login');
    } catch {
      this.message.set({ key: 'common.genericError', error: true });
      this.busy.set(false);
    }
  }
}
