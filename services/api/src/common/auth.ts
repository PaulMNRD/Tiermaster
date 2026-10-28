import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

/** User attached to a request (or a socket) by the session guard. */
export interface AuthUser {
  id: string;
  /** Pseudonym; null until chosen on first login. */
  name: string | null;
}

export type AuthenticatedRequest = Request & { user: AuthUser | null };

export const AUTH_REQUIREMENT = 'tm:auth-requirement';
export type AuthRequirement = 'user' | 'user-without-pseudonym';

/**
 * Requires a signed-in user (401 otherwise) who picked a pseudonym (403 `pseudonym_required` otherwise).
 * Routes without this decorator accept anonymous visitors; their user is then `null`.
 */
export const RequireUser = (options: { allowWithoutPseudonym?: boolean } = {}) =>
  SetMetadata<string, AuthRequirement>(AUTH_REQUIREMENT, options.allowWithoutPseudonym ? 'user-without-pseudonym' : 'user');

/** The current user, or null for an anonymous visitor. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | null => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user ?? null;
});
