import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { settle, snapshot } from '../../../testing/helpers';
import TierlistPage from './tierlist.page';

let joinRole = 'VIEWER';
const ID = '00000000-0000-4000-8000-000000000001';

describe('TierlistPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TierlistPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: RealtimeService,
          useValue: { status: signal('connected'), on: () => () => {}, onReconnect: () => () => {}, leave: () => {}, join: async () => ({ ok: true, effectiveRole: joinRole, rev: 3 }) },
        },
      ],
    });
    TestBed.inject(I18nService).setLang('en');
    http = TestBed.inject(HttpTestingController);
  });

  async function open(respond: () => void, role = 'VIEWER') {
    joinRole = role;
    const fixture = TestBed.createComponent(TierlistPage);
    fixture.componentRef.setInput('id', ID);
    await settle();
    respond();
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders categories and cards in display order, with the unsorted pool', async () => {
    const el = await open(() => http.expectOne(`/api/tierlists/${ID}`).flush(snapshot()));
    const lists = [...el.querySelectorAll('ul[aria-label]')].map((ul) => [
      ul.getAttribute('aria-label'),
      [...ul.querySelectorAll('tm-card-tile [title]')].map((card) => card.getAttribute('title')).join(' '),
    ]);
    expect(lists).toEqual([
      ['S', 'TypeScript Rust'],
      ['A', ''],
      ['Unsorted', 'COBOL'],
    ]);
    expect(el.textContent).toContain('Viewer');
  });

  it('is read-only for a viewer: no add form, drag disabled', async () => {
    const el = await open(() => http.expectOne(`/api/tierlists/${ID}`).flush(snapshot()));
    expect(el.textContent).toContain('Read-only');
    expect(el.querySelector('input[placeholder="New card"]')).toBeNull();
    expect(el.querySelector('.cdk-drop-list-disabled')).toBeTruthy();
  });

  it('lets an editor add cards', async () => {
    const el = await open(() => http.expectOne(`/api/tierlists/${ID}`).flush(snapshot({ effectiveRole: 'EDITOR' })), 'EDITOR');
    expect(el.querySelector('input[placeholder="New card"]')).toBeTruthy();
  });

  it('shows "not found or private" on 404', async () => {
    const el = await open(() => http.expectOne(`/api/tierlists/${ID}`).flush({ code: 'not_found' }, { status: 404, statusText: 'Not Found' }));
    expect(el.textContent).toContain('Tierlist not found or private');
  });

  it('asks anonymous visitors to sign in on 401', async () => {
    const el = await open(() => http.expectOne(`/api/tierlists/${ID}`).flush({ code: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' }));
    expect(el.textContent).toContain('Sign in required');
  });
});
