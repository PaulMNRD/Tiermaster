import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from './auth.service';

/** A 401 while we believed we were signed in means the session expired: refresh who we are (UI switches to anonymous). */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    tap({
      error: (error: unknown) => {
        const status = (error as { status?: number }).status;
        if (status === 401 && req.url !== '/api/me' && auth.me()) void auth.reload();
      },
    }),
  );
};
