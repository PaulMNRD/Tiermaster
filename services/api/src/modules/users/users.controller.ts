import { Body, Controller, Get, Patch } from '@nestjs/common';
import { type Me, type UpdateMe, UpdateMeSchema } from '@tiermaster/shared';
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
}
