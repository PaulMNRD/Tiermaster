import { Component, DestroyRef, inject, output, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationSchema } from '@tiermaster/shared';
import { SharingApi } from '../../core/api/sharing.api';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { RoleBadge } from '../../ui/role-badge';

/** Pending invitations by pseudonym, refreshed live when the server notifies a change. */
@Component({
  selector: 'tm-pending-invitations',
  template: `
    @if (invitations.value()?.length) {
      <section class="panel border-brand-500/40 p-4" aria-live="polite">
        <h2 class="mb-3 font-semibold">🔔 {{ 'invitations.pending' | t: { count: invitations.value()!.length } }}</h2>
        <ul class="flex flex-col gap-2">
          @for (invitation of invitations.value(); track invitation.id) {
            <li class="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
              <span class="min-w-0 flex-1 text-sm">
                {{ 'invitations.from' | t: { name: invitation.invitedBy } }}
                <strong class="break-words">{{ invitation.tierlist.title }}</strong>
              </span>
              <tm-role-badge [role]="invitation.role" />
              <button type="button" class="btn-primary min-h-9 py-1" [disabled]="busy()" (click)="accept(invitation.id)">{{ 'invitations.accept' | t }}</button>
              <button type="button" class="btn-ghost min-h-9 py-1" [disabled]="busy()" (click)="decline(invitation.id)">{{ 'invitations.decline' | t }}</button>
            </li>
          }
        </ul>
      </section>
    }
  `,
  imports: [TranslatePipe, RoleBadge],
})
export class PendingInvitations {
  private readonly api = inject(SharingApi);
  private readonly router = inject(Router);
  readonly changed = output<void>();
  protected readonly busy = signal(false);
  protected readonly invitations = resource({ loader: () => this.api.myInvitations() });

  constructor() {
    const unsubscribe = inject(RealtimeService).on('notification', (payload) => {
      if (NotificationSchema.safeParse(payload).data?.type === 'invitations.changed') this.invitations.reload();
    });
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  protected async accept(id: string): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.api.acceptMine(id);
      this.changed.emit();
      await this.router.navigate(['/t', result.tierlistId]);
    } finally {
      this.busy.set(false);
      this.invitations.reload();
    }
  }

  protected async decline(id: string): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.declineMine(id);
    } finally {
      this.busy.set(false);
      this.invitations.reload();
    }
  }
}
