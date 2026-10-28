import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { settle } from '../../../testing/helpers';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import ProfilePage from './profile.page';

describe('ProfilePage', () => {
  it('deletes the account only after typing the pseudonym', async () => {
    const me = signal<object | null>({ id: '00000000-0000-4000-8000-000000000001', name: 'Alice', email: 'a@x.test', avatarUrl: null, needsPseudonym: false });
    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { me, reload: async () => null } }],
    });
    TestBed.inject(I18nService).setLang('en');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ProfilePage);
    await settle();
    const el = fixture.nativeElement as HTMLElement;
    const button = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Delete my account'))!;
    expect(button.disabled).toBe(true);

    const input = el.querySelector<HTMLInputElement>('#profile-confirm')!;
    input.value = 'Alice';
    input.dispatchEvent(new Event('input'));
    await settle();
    expect(button.disabled).toBe(false);
    button.click();
    TestBed.inject(HttpTestingController).expectOne({ method: 'DELETE', url: '/api/me' }).flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    expect(me()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
