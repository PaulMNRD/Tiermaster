import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import type { Me } from '@tiermaster/shared';
import { authGuard, guestGuard, pseudonymGuard, safeReturnTo } from './auth.guards';
import { AuthService } from './auth.service';

const ME: Me = { id: '7a4f5c1e-3c1b-4a8e-9a8e-3a1b2c3d4e5f', name: 'Alice', email: null, avatarUrl: null, needsPseudonym: false };

describe('auth guards', () => {
  let me: Me | null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { ensureLoaded: () => Promise.resolve(me) } }],
    });
  });

  const run = (guard: typeof authGuard, url = '/t/1', query: Record<string, string> = {}) =>
    TestBed.runInInjectionContext(() =>
      guard({ queryParamMap: new Map(Object.entries(query)) } as unknown as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  const serialize = (result: boolean | UrlTree) =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;

  it('authGuard sends anonymous visitors to the login page with a return URL', async () => {
    me = null;
    expect(serialize(await run(authGuard))).toBe('/login?returnTo=%2Ft%2F1');
  });

  it('authGuard sends users without pseudonym to the welcome page', async () => {
    me = { ...ME, name: null, needsPseudonym: true };
    expect(serialize(await run(authGuard))).toBe('/welcome?returnTo=%2Ft%2F1');
  });

  it('authGuard lets complete users through', async () => {
    me = ME;
    expect(await run(authGuard)).toBe(true);
  });

  it('pseudonymGuard sends users who already have one to their return URL', async () => {
    me = ME;
    expect(serialize(await run(pseudonymGuard, '/welcome', { returnTo: '/join/x' }))).toBe('/join/x');
  });

  it('guestGuard sends signed-in users home', async () => {
    me = ME;
    expect(serialize(await run(guestGuard))).toBe('/');
    me = null;
    expect(await run(guestGuard)).toBe(true);
  });

  it('safeReturnTo rejects external targets', () => {
    expect(safeReturnTo('https://evil.example')).toBe('/');
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('/t/1')).toBe('/t/1');
  });
});
