import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { type Me, type PublicUser, type UpdateMe, UpdateMeSchema, type UserSearchQuery, UserSearchQuerySchema } from '@tiermaster/shared';
import { type AuthUser, CurrentUser, RequireUser } from '../../common/auth.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { UsersService } from './users.service.js';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

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

  @Get('users/search')
  @RequireUser()
  async search(@CurrentUser() user: AuthUser, @Query(new ZodPipe(UserSearchQuerySchema)) query: UserSearchQuery): Promise<{ users: PublicUser[] }> {
    return { users: await this.users.search(user, query) };
  }
}
