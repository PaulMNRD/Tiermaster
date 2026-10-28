import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_REQUIREMENT, type AuthenticatedRequest, type AuthRequirement } from '../../common/auth.js';
import { readCookie } from '../../common/cookies.js';
import { forbidden, unauthorized } from '../../common/errors.js';
import { UsersService } from '../users/users.service.js';
import { SessionService } from './session.service.js';

export const SESSION_COOKIE = 'tm_session';

/** Global guard: attaches the session user (or null) to every HTTP request, then applies @RequireUser. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = this.sessions.verify(readCookie(req, SESSION_COOKIE), 'session');
    const user = userId ? await this.users.findById(userId) : null;
    req.user = user ? { id: user.id, name: user.name } : null;

    const requirement = this.reflector.getAllAndOverride<AuthRequirement | undefined>(AUTH_REQUIREMENT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;
    if (!req.user) throw unauthorized();
    if (requirement === 'user' && req.user.name === null) throw forbidden('pseudonym_required');
    return true;
  }
}
