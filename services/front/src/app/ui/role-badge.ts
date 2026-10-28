import { Component, computed, input } from '@angular/core';
import type { Role } from '@tiermaster/shared';
import { TranslatePipe } from '../core/i18n/translate.pipe';

const STYLES: Record<Role, string> = {
  OWNER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  MODERATOR: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
  EDITOR: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  VIEWER: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

@Component({
  selector: 'tm-role-badge',
  template: `<span class="badge {{ style() }}">{{ 'role.' + role() | t }}</span>`,
  imports: [TranslatePipe],
})
export class RoleBadge {
  readonly role = input.required<Role>();
  protected readonly style = computed(() => STYLES[this.role()]);
}
