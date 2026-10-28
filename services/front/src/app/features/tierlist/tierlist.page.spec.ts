import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { TierlistSnapshot } from '@tiermaster/shared';
import { I18nService } from '../../core/i18n/i18n.service';
import { settle } from '../../../testing/helpers';
import TierlistPage from './tierlist.page';

const ID = '00000000-0000-4000-8000-000000000001';
const S = '00000000-0000-4000-8000-0000000000a1';
const A = '00000000-0000-4000-8000-0000000000a2';

export function snapshot(overrides: Partial<TierlistSnapshot> = {}): TierlistSnapshot {
  return {
    id: ID,
    title: 'Languages',
    ownerId: '00000000-0000-4000-8000-0000000000ff',
    defaultRole: 'VIEWER',
    rev: 3,
    effectiveRole: 'VIEWER',
    categories: [
      { id: A, name: 'A', color: '#f97316', position: 'k' },
      { id: S, name: 'S', color: '#ef4444', position: 'V' },
    ],
    cards: [
      { id: '00000000-0000-4000-8000-000000000101', categoryId: S, title: 'Rust', imageKey: null, position: 'k' },
      { id: '00000000-0000-4000-8000-000000000102', categoryId: S, title: 'TypeScript', imageKey: null, position: 'V' },
      { id: '00000000-0000-4000-8000-000000000103', categoryId: null, title: 'COBOL', imageKey: null, position: 'V' },
    ],
    ...overrides,
  };
}

describe('TierlistPage (read-only)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TierlistPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(I18nService).setLang('en');
    http = TestBed.inject(HttpTestingController);
  });

  async function open(respond: () => void) {
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

  it('shows "not found or private" on 404', async () => {
    const el = await open(() => http.expectOne(`/api/tierlists/${ID}`).flush({ code: 'not_found' }, { status: 404, statusText: 'Not Found' }));
    expect(el.textContent).toContain('Tierlist not found or private');
  });

  it('asks anonymous visitors to sign in on 401', async () => {
    const el = await open(() => http.expectOne(`/api/tierlists/${ID}`).flush({ code: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' }));
    expect(el.textContent).toContain('Sign in required');
  });
});
