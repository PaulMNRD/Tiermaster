import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { settle } from '../../../testing/helpers';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import JoinPage from './join.page';

const TOKEN = 'a'.repeat(43);
const TIERLIST = '00000000-0000-4000-8000-000000000001';

describe('JoinPage', () => {
  async function open(me: object | null, respond: (http: HttpTestingController) => void) {
    TestBed.configureTestingModule({
      imports: [JoinPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { me: signal(me) } }],
    });
    TestBed.inject(I18nService).setLang('en');
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(JoinPage);
    fixture.componentRef.setInput('token', TOKEN);
    await settle();
    respond(http);
    await settle();
    return { el: fixture.nativeElement as HTMLElement, http };
  }
  const preview = { tierlistId: TIERLIST, tierlistTitle: 'Pizza', role: 'EDITOR', invitedBy: 'Bob', expiresAt: new Date().toISOString() };

  it('asks anonymous visitors to sign in, coming back to the link', async () => {
    const { el } = await open(null, (http) => http.expectOne(`/api/invitations/${TOKEN}`).flush(preview));
    expect(el.textContent).toContain('Bob invites you to join');
    expect(el.querySelector('a[href^="/login"]')?.getAttribute('href')).toBe(`/login?returnTo=%2Fjoin%2F${TOKEN}`);
  });

  it('accepts and opens the tierlist', async () => {
    const { el, http } = await open({ id: 'x' }, (h) => h.expectOne(`/api/invitations/${TOKEN}`).flush(preview));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (el.querySelector('button') as HTMLButtonElement).click();
    http.expectOne(`/api/invitations/${TOKEN}/accept`).flush({ tierlistId: TIERLIST, role: 'EDITOR', changed: true });
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/t', TIERLIST]);
  });

  it('explains an invalid link', async () => {
    const { el } = await open(null, (http) => http.expectOne(`/api/invitations/${TOKEN}`).flush({ code: 'invitation_invalid' }, { status: 404, statusText: 'Not Found' }));
    expect(el.textContent).toContain('Invitation not valid');
  });
});
