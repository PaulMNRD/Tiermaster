import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type AuthProviderId,
  AuthProvidersResponseSchema,
  type Me,
  MeSchema,
  SocketTokenResponseSchema,
} from '@tiermaster/shared';
import { firstValueFrom } from 'rxjs';
import { toApiFailure } from '../api/api-error';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  /** `undefined` until the first `/api/me` answer, then the user or `null` (anonymous). */
  readonly me = signal<Me | null | undefined>(undefined);
  readonly isSignedIn = computed(() => !!this.me());
  private loading: Promise<Me | null> | null = null;

  /** Loads the current user once; later calls reuse the result. */
  ensureLoaded(): Promise<Me | null> {
    const current = this.me();
    if (current !== undefined) return Promise.resolve(current);
    this.loading ??= this.reload();
    return this.loading;
  }

  async reload(): Promise<Me | null> {
    try {
      const me = MeSchema.parse(await firstValueFrom(this.http.get('/api/me')));
      this.me.set(me);
      return me;
    } catch (error) {
      if (toApiFailure(error).status !== 401) console.warn('Could not load the current user', error);
      this.me.set(null);
      return null;
    } finally {
      this.loading = null;
    }
  }

  async providers(): Promise<AuthProviderId[]> {
    return AuthProvidersResponseSchema.parse(await firstValueFrom(this.http.get('/api/auth/providers'))).providers;
  }

  /** Full-page navigation target that starts the OAuth flow. */
  loginUrl(provider: AuthProviderId, returnTo = '/', loginHint?: string): string {
    const params = new URLSearchParams({ returnTo });
    if (loginHint) params.set('loginHint', loginHint);
    return `/api/auth/${provider}?${params}`;
  }

  async setPseudonym(name: string): Promise<Me> {
    const me = MeSchema.parse(await firstValueFrom(this.http.patch('/api/me', { name })));
    this.me.set(me);
    return me;
  }

  async socketToken(): Promise<string | null> {
    if (!this.me()) return null;
    try {
      return SocketTokenResponseSchema.parse(await firstValueFrom(this.http.get('/api/auth/socket-token'))).token;
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this.me.set(null);
  }
}
