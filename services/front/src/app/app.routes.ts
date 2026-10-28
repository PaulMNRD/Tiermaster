import type { Routes } from '@angular/router';
import { authGuard, guestGuard, identityGuard, pseudonymGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  { path: '', canActivate: [authGuard], loadComponent: () => import('./features/home/home.page') },
  { path: 'community', canActivate: [identityGuard], loadComponent: () => import('./features/community/community.page') },
  { path: 't/:id', canActivate: [identityGuard], loadComponent: () => import('./features/tierlist/tierlist.page') },
  { path: 't/:id/settings', canActivate: [authGuard], loadComponent: () => import('./features/settings/settings.page') },
  { path: 'join/:token', canActivate: [identityGuard], loadComponent: () => import('./features/join/join.page') },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./features/profile/profile.page') },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.page') },
  { path: 'welcome', canActivate: [pseudonymGuard], loadComponent: () => import('./features/auth/welcome.page') },
  { path: '**', canActivate: [identityGuard], loadComponent: () => import('./features/errors/not-found.page') },
];
