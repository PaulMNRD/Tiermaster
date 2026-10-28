import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { RealtimeService } from '../core/realtime/realtime.service';

/** Status of the real-time link: live, reconnecting, or offline (with a manual retry). */
@Component({
  selector: 'tm-connection-indicator',
  template: `
    <span class="inline-flex items-center gap-1.5 text-xs" role="status" aria-live="polite">
      <span class="size-2 rounded-full" [class]="dot()"></span>
      <span class="text-slate-500 dark:text-slate-400">{{ label() | t }}</span>
      @if (status() === 'offline' || status() === 'reconnecting') {
        <button type="button" class="underline" (click)="realtime.reconnect()">{{ 'common.retry' | t }}</button>
      }
    </span>
  `,
  imports: [TranslatePipe],
})
export class ConnectionIndicator {
  protected readonly realtime = inject(RealtimeService);
  protected readonly status = this.realtime.status;
  protected readonly dot = computed(() => {
    switch (this.status()) {
      case 'connected':
        return 'bg-emerald-500';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-amber-400 animate-pulse';
    }
  });
  protected readonly label = computed(() => `connection.${this.status()}`);
}
