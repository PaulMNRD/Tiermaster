import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PseudonymSchema } from '@tiermaster/shared';
import { toApiFailure } from '../../core/api/api-error';
import { safeReturnTo } from '../../core/auth/auth.guards';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** First-login step: picking a pseudonym. */
@Component({
  template: `
    <section class="mx-auto flex max-w-sm flex-col gap-6 px-4 py-12">
      <header>
        <h1 class="text-2xl font-bold">{{ 'welcome.title' | t }}</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ 'welcome.subtitle' | t }}</p>
      </header>
      <form class="flex flex-col gap-3" (submit)="submit($event)">
        <label class="text-sm font-medium" for="pseudonym">{{ 'welcome.label' | t }}</label>
        <input id="pseudonym" class="input" [value]="name()" (input)="name.set($any($event.target).value)"
               autocomplete="nickname" maxlength="24" required [attr.aria-invalid]="!!error()" aria-describedby="pseudonym-help" />
        <p id="pseudonym-help" class="text-xs" [class.text-red-600]="error()" [class.text-slate-500]="!error()">
          {{ (error() ?? 'welcome.hint') | t }}
        </p>
        <button class="btn-primary" type="submit" [disabled]="saving()">{{ 'welcome.submit' | t }}</button>
      </form>
    </section>
  `,
  imports: [TranslatePipe],
})
export default class WelcomePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly returnTo = input<string>();

  protected readonly name = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const parsed = PseudonymSchema.safeParse(this.name());
    if (!parsed.success) {
      this.error.set('error.pseudonym_invalid');
      return;
    }
    this.saving.set(true);
    try {
      await this.auth.setPseudonym(parsed.data);
      await this.router.navigateByUrl(safeReturnTo(this.returnTo()));
    } catch (error) {
      const failure = toApiFailure(error);
      this.error.set(failure.code === 'pseudonym_taken' ? 'error.pseudonym_taken' : 'common.genericError');
    } finally {
      this.saving.set(false);
    }
  }
}
