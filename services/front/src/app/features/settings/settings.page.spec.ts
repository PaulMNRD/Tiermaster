import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Member, Role } from '@tiermaster/shared';
import { settle, snapshot } from '../../../testing/helpers';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import SettingsPage from './settings.page';

const ID = '00000000-0000-4000-8000-000000000001';
const ME = '00000000-0000-4000-8000-0000000000e1';
const user = (id: string, name: string) => ({ id, name, avatarUrl: null });
const MEMBERS = (myRole: Role): Member[] => [
  { user: user('00000000-0000-4000-8000-0000000000ff', 'Olivia'), role: 'OWNER' },
  { user: user('00000000-0000-4000-8000-0000000000e2', 'Mona'), role: 'MODERATOR' },
  { user: user('00000000-0000-4000-8000-0000000000e3', 'Eddie'), role: 'EDITOR' },
  ...(myRole === 'OWNER' ? [] : [{ user: user(ME, 'Me'), role: myRole }]),
];

describe('SettingsPage', () => {
  let http: HttpTestingController;

  async function open(role: Role) {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { me: signal({ id: role === 'OWNER' ? '00000000-0000-4000-8000-0000000000ff' : ME }) } },
      ],
    });
    TestBed.inject(I18nService).setLang('en');
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.componentRef.setInput('id', ID);
    await settle();
    http.expectOne(`/api/tierlists/${ID}`).flush(snapshot({ effectiveRole: role }));
    await settle();
    http.expectOne(`/api/tierlists/${ID}/members`).flush({ members: MEMBERS(role) });
    await settle();
    if (role === 'OWNER' || role === 'MODERATOR') {
      http.expectOne(`/api/tierlists/${ID}/invitations`).flush({ invitations: [] });
      await settle();
    }
    return fixture.nativeElement as HTMLElement;
  }

  const roleSelects = (el: HTMLElement) => [...el.querySelectorAll('select[aria-label^="Role of"]')].map((s) => s.getAttribute('aria-label'));

  it('owner: visibility, member roles including moderator, invitations, delete', async () => {
    const el = await open('OWNER');
    expect(el.querySelector('#settings-visibility')).toBeTruthy();
    expect(roleSelects(el)).toEqual(['Role of Mona', 'Role of Eddie']);
    expect(el.textContent).toContain('Delete the tierlist');
    expect(el.textContent).not.toContain('Leave');
    const options = [...el.querySelectorAll('select[aria-label="Role to give"] option')].map((o) => o.textContent?.trim());
    expect(options).toEqual(['Moderator', 'Editor', 'Viewer']);
  });

  it('moderator: cannot change visibility, moderators or the owner; can only grant editor and viewer; can leave', async () => {
    const el = await open('MODERATOR');
    expect(el.querySelector('#settings-visibility')).toBeNull();
    expect(roleSelects(el)).toEqual(['Role of Eddie']);
    const options = [...el.querySelectorAll('select[aria-label="Role to give"] option')].map((o) => o.textContent?.trim());
    expect(options).toEqual(['Editor', 'Viewer']);
    expect(el.textContent).toContain('Leave');
    expect(el.textContent).not.toContain('Delete the tierlist');
  });

  it('viewer: read-only member list, no invitations, can leave', async () => {
    const el = await open('VIEWER');
    expect(roleSelects(el)).toEqual([]);
    expect(el.querySelector('input[name="title"]')).toBeNull();
    expect(el.textContent).not.toContain('Create an invitation link');
    expect(el.textContent).toContain('Leave');
  });

  it('owner changes a role through the API', async () => {
    const el = await open('OWNER');
    const select = el.querySelector<HTMLSelectElement>('select[aria-label="Role of Eddie"]')!;
    select.value = 'VIEWER';
    select.dispatchEvent(new Event('change'));
    const req = http.expectOne(`/api/tierlists/${ID}/members/00000000-0000-4000-8000-0000000000e3`);
    expect(req.request.body).toEqual({ role: 'VIEWER' });
  });
});
