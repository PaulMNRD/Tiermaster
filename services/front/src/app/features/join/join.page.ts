import { Component, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toApiFailure } from '../../core/api/api-error';
import { SharingApi } from '../../core/api/sharing.api';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RoleBadge } from '../../ui/role-badge';
import { LoadingState } from '../../ui/states';

/** Invitation link landing page: preview, then sign in (if needed) and accept. */
@Component({
  template: `
    <section class="mx-auto flex max-w-md flex-col gap-4 px-4 py-12 text-center">
      @if (preview.isLoading()) {
        <tm-loading />
      } @else if (preview.error()) {
        <div class="text-5xl" aria-hidden="true">✉️</div>
        <h1 class="text-xl font-bold">{{ 'join.invalidTitle' | t }}</h1>
        <p class="text-slate-500 dark:text-slate-400">{{ 'join.invalidBody' | t }}</p>
        <a class="btn-ghost" routerLink="/">{{ 'common.backHome' | t }}</a>
      } @else if (preview.value(); as p) {
        <div class="text-5xl" aria-hidden="true">✉️</div>
        <h1 class="text-xl font-bold">{{ 'join.title' | t: { name: p.invitedBy } }}</h1>
        <p class="text-lg font-semibold break-words">{{ p.tierlistTitle }}</p>
        <p class="flex items-center justify-center gap-2 text-sm text-slate-500">{{ 'join.as' | t }} <tm-role-badge [role]="p.role" /></p>
        @if (auth.me()) {
          <button type="button" class="btn-primary" [disabled]="accepting()" (click)="accept(p.tierlistId)">{{ 'invitations.accept' | t }}</button>
        } @else {
          <a class="btn-primary" routerLink="/login" [queryParams]="{ returnTo: '/join/' + token() }">{{ 'join.signInToAccept' | t }}</a>
        }
        @if (error()) {
          <p class="text-sm text-red-600" role="alert">{{ error()! | t }}</p>
        }
      }
    </section>
  `,
  imports: [TranslatePipe, RouterLink, RoleBadge, LoadingState],
})
export default class JoinPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(SharingApi);
  private readonly router = inject(Router);
  readonly token = input.required<string>();
  protected readonly accepting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly preview = resource({ params: () => this.token(), loader: ({ params }) => this.api.preview(params) });

  protected async accept(tierlistId: string): Promise<void> {
    this.accepting.set(true);
    this.error.set(null);
    try {
      await this.api.acceptLink(this.token());
      await this.router.navigate(['/t', tierlistId]);
    } catch (error) {
      this.error.set(toApiFailure(error).status === 404 ? 'join.invalidBody' : 'common.genericError');
    } finally {
      this.accepting.set(false);
    }
  }
}
