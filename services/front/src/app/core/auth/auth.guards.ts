import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Signed-in users with a pseudonym only; others go to the login or pseudonym page. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const me = await inject(AuthService).ensureLoaded();
  if (!me) return router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });
  if (me.needsPseudonym) return router.createUrlTree(['/welcome'], { queryParams: { returnTo: state.url } });
  return true;
};

/** Pseudonym page: only for signed-in users who have not picked one yet. */
export const pseudonymGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const me = await inject(AuthService).ensureLoaded();
  if (!me) return router.createUrlTree(['/login']);
  if (!me.needsPseudonym) return router.parseUrl(safeReturnTo(route.queryParamMap.get('returnTo')));
  return true;
};

/** Login page: signed-in users are sent home. */
export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const me = await inject(AuthService).ensureLoaded();
  return me ? router.createUrlTree(['/']) : true;
};

/** Pages open to everyone that still need to know who the visitor is (and force the pseudonym step). */
export const identityGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const me = await inject(AuthService).ensureLoaded();
  if (me?.needsPseudonym) return router.createUrlTree(['/welcome'], { queryParams: { returnTo: state.url } });
  return true;
};

export function safeReturnTo(value: string | null | undefined): string {
  return value && /^\/(?![/\\])/.test(value) ? value : '/';
}
