import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('shows a sign-in link to anonymous visitors', async () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(HttpTestingController).expectOne('/api/me').flush({ code: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href="/login"]')).toBeTruthy();
  });

  it('shows the pseudonym of the signed-in user', async () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/me')
      .flush({ id: '7a4f5c1e-3c1b-4a8e-9a8e-3a1b2c3d4e5f', name: 'Alice', email: null, avatarUrl: null, needsPseudonym: false });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Alice');
  });
});
