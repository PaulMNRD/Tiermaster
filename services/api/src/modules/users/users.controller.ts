import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { type Me, type PublicUser, type UpdateMe, UpdateMeSchema, type UserSearchQuery, UserSearchQuerySchema } from '@tiermaster/shared';
import { type AuthUser, CurrentUser, RequireUser } from '../../common/auth.js';
import { RateLimit } from '../../common/rate-limit.js';
import { cookieOptions, SESSION_COOKIE } from '../../common/session-cookie.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { UsersService } from './users.service.js';

@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('me')
  @RequireUser({ allowWithoutPseudonym: true })
  me(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  @RequireUser({ allowWithoutPseudonym: true })
  update(@CurrentUser() user: AuthUser, @Body(new ZodPipe(UpdateMeSchema)) body: UpdateMe): Promise<Me> {
    return this.users.setPseudonym(user.id, body.name);
  }

  /** Deletes the account, its tierlists (for everyone) and memberships, then signs out. */
  @Delete('me')
  @RequireUser({ allowWithoutPseudonym: true })
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.users.deleteAccount(user);
    res.clearCookie(SESSION_COOKIE, cookieOptions(this.config));
  }

  @Get('users/search')
  @RequireUser()
  @RateLimit('search')
  async search(@CurrentUser() user: AuthUser, @Query(new ZodPipe(UserSearchQuerySchema)) query: UserSearchQuery): Promise<{ users: PublicUser[] }> {
    return { users: await this.users.search(user, query) };
  }
}
