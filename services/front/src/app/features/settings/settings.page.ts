import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  assignableRoles,
  can,
  canGrant,
  type DefaultRole,
  type Invitation,
  type Member,
  type MemberRole,
  type PublicUser,
  type TierlistSnapshot,
  TierlistTitleSchema,
} from '@tiermaster/shared';
import { type ApiFailure, toApiFailure } from '../../core/api/api-error';
import { ContentApi } from '../../core/api/content.api';
import { SharingApi } from '../../core/api/sharing.api';
import { TierlistsApi } from '../../core/api/tierlists.api';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RoleBadge } from '../../ui/role-badge';
import { ErrorState, LoadingState } from '../../ui/states';

const MEMBER_ROLES: MemberRole[] = ['MODERATOR', 'EDITOR', 'VIEWER'];

/** Tierlist settings: rename, visibility, members and invitations, leave, delete. Controls follow the effective role. */
@Component({
  template: `
    @if (loading()) {
      <tm-loading />
    } @else if (failure()) {
      <tm-error [status]="failure()!.status" variant="tierlist" [returnTo]="router.url" />
    } @else if (tierlist(); as t) {
      <section class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        <header class="flex flex-wrap items-center gap-2">
          <a class="btn-ghost px-2" [routerLink]="['/t', t.id]" [attr.aria-label]="'common.back' | t">←</a>
          <h1 class="flex-1 text-xl font-bold break-words">{{ 'settings.title' | t: { title: t.title } }}</h1>
          <tm-role-badge [role]="t.effectiveRole" />
        </header>
        @if (message(); as m) {
          <p class="rounded-lg p-3 text-sm" role="status"
             [class]="m.error ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'">
            {{ m.key | t }}
          </p>
        }

        @if (can(t.effectiveRole, 'tierlist.rename')) {
          <form class="panel flex flex-col gap-3 p-4" (submit)="rename($event)">
            <h2 class="font-semibold">{{ 'settings.general' | t }}</h2>
            <label class="text-sm" for="settings-title">{{ 'tierlist.title' | t }}</label>
            <div class="flex gap-2">
              <input id="settings-title" class="input" name="title" [value]="t.title" maxlength="100" />
              <button class="btn-primary shrink-0" type="submit">{{ 'common.save' | t }}</button>
            </div>
          </form>
        }

        <section class="panel flex flex-col gap-3 p-4">
          <h2 class="font-semibold">{{ 'settings.visibility' | t }}</h2>
          @if (can(t.effectiveRole, 'tierlist.changeDefaultRole')) {
            <label class="text-sm" for="settings-visibility">{{ 'settings.visibilityHelp' | t }}</label>
            <select id="settings-visibility" class="input" [value]="t.defaultRole ?? 'PRIVATE'" (change)="setVisibility($any($event.target).value)">
              <option value="PRIVATE">{{ 'visibility.PRIVATE' | t }}</option>
              <option value="VIEWER">{{ 'visibility.VIEWER' | t }}</option>
              <option value="EDITOR">{{ 'visibility.EDITOR' | t }}</option>
            </select>
          } @else {
            <p class="text-sm">{{ 'visibility.' + (t.defaultRole ?? 'PRIVATE') | t }}</p>
          }
        </section>

        <section class="panel flex flex-col gap-3 p-4">
          <h2 class="font-semibold">{{ 'settings.members' | t }}</h2>
          <ul class="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            @for (member of members(); track member.user.id) {
              <li class="flex flex-wrap items-center gap-2 py-2">
                <span class="min-w-0 flex-1 truncate">{{ member.user.name }} @if (member.user.id === me()) { <span class="text-xs text-slate-500">({{ 'settings.you' | t }})</span> }</span>
                @if (rolesFor(member).length && member.user.id !== me()) {
                  <select class="input w-auto min-h-9 py-1" [attr.aria-label]="('settings.roleOf' | t: { name: member.user.name })"
                          [value]="member.role" (change)="changeRole(member, $any($event.target).value)">
                    <option [value]="member.role" disabled>{{ 'role.' + member.role | t }}</option>
                    @for (role of rolesFor(member); track role) {
                      @if (role !== member.role) {
                        <option [value]="role">{{ 'role.' + role | t }}</option>
                      }
                    }
                  </select>
                } @else {
                  <tm-role-badge [role]="member.role" />
                }
                @if (canRemove(member)) {
                  <button type="button" class="btn-ghost min-h-9 py-1 text-red-600" (click)="remove(member)">{{ 'settings.remove' | t }}</button>
                }
              </li>
            }
          </ul>
        </section>

        @if (can(t.effectiveRole, 'member.invite')) {
          <section class="panel flex flex-col gap-3 p-4">
            <h2 class="font-semibold">{{ 'settings.invite' | t }}</h2>
            <div class="flex flex-col gap-2 sm:flex-row">
              <input class="input" type="search" [placeholder]="'settings.searchUser' | t" [attr.aria-label]="'settings.searchUser' | t"
                     [value]="query()" (input)="search($any($event.target).value)" />
              <select class="input sm:w-40" [attr.aria-label]="'settings.inviteRole' | t" [value]="inviteRole()" (change)="inviteRole.set($any($event.target).value)">
                @for (role of assignable(); track role) {
                  <option [value]="role">{{ 'role.' + role | t }}</option>
                }
              </select>
            </div>
            @if (results().length) {
              <ul class="flex flex-col gap-1">
                @for (user of results(); track user.id) {
                  <li class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                    <span class="truncate">{{ user.name }}</span>
                    <button type="button" class="btn-primary min-h-9 py-1" (click)="invite(user)">{{ 'settings.inviteUser' | t }}</button>
                  </li>
                }
              </ul>
            } @else if (query().length >= 2 && searched()) {
              <p class="text-sm text-slate-500">{{ 'settings.noUser' | t }}</p>
            }
            <div class="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <button type="button" class="btn-secondary" (click)="createLink()">🔗 {{ 'settings.createLink' | t: { role: ('role.' + inviteRole() | t) } }}</button>
              @if (link()) {
                <div class="flex w-full flex-col gap-1">
                  <div class="flex gap-2">
                    <input class="input font-mono text-xs" readonly [value]="link()" [attr.aria-label]="'settings.link' | t" (focus)="$any($event.target).select()" />
                    <button type="button" class="btn-secondary shrink-0" (click)="copyLink()">{{ (copied() ? 'settings.copied' : 'settings.copy') | t }}</button>
                  </div>
                  <p class="text-xs text-amber-700 dark:text-amber-300">{{ 'settings.linkOnce' | t }}</p>
                </div>
              }
            </div>
            @if (invitations().length) {
              <h3 class="mt-2 text-sm font-semibold">{{ 'settings.pendingInvitations' | t }}</h3>
              <ul class="flex flex-col divide-y divide-slate-200 text-sm dark:divide-slate-800">
                @for (invitation of invitations(); track invitation.id) {
                  <li class="flex flex-wrap items-center gap-2 py-2">
                    <span class="min-w-0 flex-1 truncate">
                      {{ invitation.invitee?.name ?? ('settings.linkInvitation' | t) }} ·
                      <span class="text-slate-500">{{ 'settings.by' | t: { name: invitation.createdBy.name } }}</span>
                    </span>
                    <tm-role-badge [role]="invitation.role" />
                    <button type="button" class="btn-ghost min-h-9 py-1" (click)="revoke(invitation)">{{ 'settings.revoke' | t }}</button>
                  </li>
                }
              </ul>
            }
          </section>
        }

        <section class="panel flex flex-col gap-3 border-red-300 p-4 dark:border-red-900">
          <h2 class="font-semibold text-red-700 dark:text-red-400">{{ 'settings.danger' | t }}</h2>
          @if (isMember()) {
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm">{{ 'settings.leaveHelp' | t }}</p>
              <button type="button" class="btn-secondary" (click)="leave()">{{ 'settings.leave' | t }}</button>
            </div>
          }
          @if (can(t.effectiveRole, 'tierlist.delete')) {
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm">{{ 'settings.deleteHelp' | t }}</p>
              <button type="button" class="btn-danger" (click)="deleteTierlist()">{{ 'settings.delete' | t }}</button>
            </div>
          }
          @if (!isMember() && !can(t.effectiveRole, 'tierlist.delete')) {
            <p class="text-sm text-slate-500">{{ 'settings.nothingHere' | t }}</p>
          }
        </section>
      </section>
    }
  `,
  imports: [TranslatePipe, RouterLink, RoleBadge, LoadingState, ErrorState],
})
export default class SettingsPage {
  protected readonly router = inject(Router);
  private readonly content = inject(ContentApi);
  private readonly sharing = inject(SharingApi);
  private readonly tierlists = inject(TierlistsApi);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  readonly id = input.required<string>();

  protected readonly can = can;
  protected readonly loading = signal(true);
  protected readonly failure = signal<ApiFailure | null>(null);
  protected readonly tierlist = signal<TierlistSnapshot | null>(null);
  protected readonly members = signal<Member[]>([]);
  protected readonly invitations = signal<Invitation[]>([]);
  protected readonly message = signal<{ key: string; error: boolean } | null>(null);
  protected readonly query = signal('');
  protected readonly searched = signal(false);
  protected readonly results = signal<PublicUser[]>([]);
  protected readonly inviteRole = signal<MemberRole>('VIEWER');
  protected readonly link = signal<string | null>(null);
  protected readonly copied = signal(false);

  protected readonly me = computed(() => this.auth.me()?.id ?? null);
  protected readonly myRole = computed(() => this.tierlist()?.effectiveRole ?? null);
  protected readonly assignable = computed(() => assignableRoles(this.myRole()));
  protected readonly isMember = computed(() => this.members().some((m) => m.user.id === this.me() && m.role !== 'OWNER'));
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  protected rolesFor(member: Member): MemberRole[] {
    return MEMBER_ROLES.filter((role) => canGrant(this.myRole(), member.role, role));
  }

  protected canRemove(member: Member): boolean {
    return member.user.id !== this.me() && canGrant(this.myRole(), member.role, null);
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const tierlist = await this.content.snapshot(id);
      this.tierlist.set(tierlist);
      this.members.set(await this.sharing.members(id));
      this.invitations.set(can(tierlist.effectiveRole, 'member.invite') ? await this.sharing.invitations(id) : []);
      if (!this.assignable().includes(this.inviteRole())) this.inviteRole.set(this.assignable().at(-1) ?? 'VIEWER');
      this.failure.set(null);
    } catch (error) {
      this.failure.set(toApiFailure(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** Runs an action, shows its outcome and reloads the page data. */
  private async run(action: () => Promise<unknown>, successKey = 'settings.saved'): Promise<boolean> {
    try {
      await action();
      this.message.set({ key: successKey, error: false });
      await this.load(this.id());
      return true;
    } catch (error) {
      const failure = toApiFailure(error);
      const key = `error.${failure.code}`;
      this.message.set({ key: this.i18n.has(key) ? key : failure.status === 403 ? 'error.403.body' : 'common.genericError', error: true });
      return false;
    }
  }

  protected rename(event: Event): void {
    event.preventDefault();
    const value = new FormData(event.target as HTMLFormElement).get('title');
    const title = TierlistTitleSchema.safeParse(value);
    if (title.success) void this.run(() => this.tierlists.update(this.id(), { title: title.data }));
  }

  protected setVisibility(value: 'PRIVATE' | 'VIEWER' | 'EDITOR'): void {
    const defaultRole: DefaultRole = value === 'PRIVATE' ? null : value;
    void this.run(() => this.tierlists.update(this.id(), { defaultRole }));
  }

  protected changeRole(member: Member, role: MemberRole): void {
    void this.run(() => this.sharing.changeRole(this.id(), member.user.id, role));
  }

  protected remove(member: Member): void {
    if (!confirm(this.i18n.t('settings.confirmRemove', { name: member.user.name }))) return;
    void this.run(() => this.sharing.removeMember(this.id(), member.user.id));
  }

  protected search(value: string): void {
    this.query.set(value.trim());
    clearTimeout(this.searchTimer);
    this.searched.set(false);
    if (this.query().length < 2) {
      this.results.set([]);
      return;
    }
    this.searchTimer = setTimeout(async () => {
      try {
        this.results.set(await this.sharing.searchUsers(this.query(), this.id()));
      } catch {
        this.results.set([]);
      }
      this.searched.set(true);
    }, 250);
  }

  protected async invite(user: PublicUser): Promise<void> {
    const ok = await this.run(() => this.sharing.invite(this.id(), { role: this.inviteRole(), inviteeId: user.id }), 'settings.invited');
    if (ok) {
      this.results.set([]);
      this.query.set('');
    }
  }

  protected async createLink(): Promise<void> {
    this.copied.set(false);
    await this.run(async () => this.link.set((await this.sharing.invite(this.id(), { role: this.inviteRole() })).url), 'settings.linkCreated');
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link() ?? '');
      this.copied.set(true);
    } catch {
      // Clipboard unavailable: the field is selectable.
    }
  }

  protected revoke(invitation: Invitation): void {
    void this.run(() => this.sharing.revokeInvitation(this.id(), invitation.id));
  }

  protected async leave(): Promise<void> {
    if (!confirm(this.i18n.t('settings.confirmLeave'))) return;
    try {
      await this.sharing.leave(this.id());
      await this.router.navigateByUrl('/');
    } catch {
      this.message.set({ key: 'common.genericError', error: true });
    }
  }

  protected async deleteTierlist(): Promise<void> {
    if (!confirm(this.i18n.t('settings.confirmDelete', { title: this.tierlist()?.title ?? '' }))) return;
    try {
      await this.tierlists.delete(this.id());
      await this.router.navigateByUrl('/');
    } catch {
      this.message.set({ key: 'common.genericError', error: true });
    }
  }
}
