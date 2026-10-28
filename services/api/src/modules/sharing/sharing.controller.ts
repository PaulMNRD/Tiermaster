import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type AcceptInvitationResponse,
  type ChangeMemberRole,
  ChangeMemberRoleSchema,
  type CreateInvitation,
  type CreateInvitationResponse,
  CreateInvitationSchema,
  type Invitation,
  type InvitationPreview,
  InvitationTokenSchema,
  type MembersResponse,
  type MyInvitation,
} from '@tiermaster/shared';
import { type AuthUser, CurrentUser, RequireUser } from '../../common/auth.js';
import { notFound } from '../../common/errors.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { InvitationsService } from './invitations.service.js';
import { MembersService } from './members.service.js';

/** Tokens are validated like ids: a malformed one is simply unknown. */
class TokenPipe {
  transform(value: unknown): string {
    const result = InvitationTokenSchema.safeParse(value);
    if (!result.success) throw notFound('invitation_invalid');
    return result.data;
  }
}

@Controller()
export class SharingController {
  constructor(
    private readonly members: MembersService,
    private readonly invitations: InvitationsService,
  ) {}

  // ---- members ----

  @Get('tierlists/:id/members')
  async listMembers(@CurrentUser() user: AuthUser | null, @Param('id', UuidPipe) id: string): Promise<MembersResponse> {
    return { members: await this.members.list(user, id) };
  }

  @Patch('tierlists/:id/members/:userId')
  @RequireUser()
  changeRole(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Param('userId', UuidPipe) userId: string,
    @Body(new ZodPipe(ChangeMemberRoleSchema)) body: ChangeMemberRole,
  ): Promise<{ rev: number }> {
    return this.members.changeRole(user, id, userId, body.role);
  }

  @Delete('tierlists/:id/members/:userId')
  @RequireUser()
  @HttpCode(204)
  async removeMember(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string, @Param('userId', UuidPipe) userId: string) {
    await this.members.remove(user, id, userId);
  }

  @Post('tierlists/:id/leave')
  @RequireUser()
  @HttpCode(204)
  async leave(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string) {
    await this.members.leave(user, id);
  }

  // ---- invitations (managed by owner and moderators) ----

  @Post('tierlists/:id/invitations')
  @RequireUser()
  createInvitation(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(CreateInvitationSchema)) body: CreateInvitation,
  ): Promise<CreateInvitationResponse> {
    return this.invitations.create(user, id, body);
  }

  @Get('tierlists/:id/invitations')
  @RequireUser()
  async listInvitations(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<{ invitations: Invitation[] }> {
    return { invitations: await this.invitations.list(user, id) };
  }

  @Delete('tierlists/:id/invitations/:invitationId')
  @RequireUser()
  @HttpCode(204)
  async revokeInvitation(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Param('invitationId', UuidPipe) invitationId: string,
  ) {
    await this.invitations.revoke(user, id, invitationId);
  }

  // ---- links ----

  @Get('invitations/:token')
  preview(@Param('token', TokenPipe) token: string): Promise<InvitationPreview> {
    return this.invitations.preview(token);
  }

  @Post('invitations/:token/accept')
  @RequireUser()
  @HttpCode(200)
  acceptLink(@CurrentUser() user: AuthUser, @Param('token', TokenPipe) token: string): Promise<AcceptInvitationResponse> {
    return this.invitations.acceptLink(user, token);
  }

  // ---- my pending invitations (by pseudonym) ----

  @Get('me/invitations')
  @RequireUser()
  async mine(@CurrentUser() user: AuthUser): Promise<{ invitations: MyInvitation[] }> {
    return { invitations: await this.invitations.mine(user) };
  }

  @Post('me/invitations/:invitationId/accept')
  @RequireUser()
  @HttpCode(200)
  acceptMine(@CurrentUser() user: AuthUser, @Param('invitationId', UuidPipe) id: string): Promise<AcceptInvitationResponse> {
    return this.invitations.acceptMine(user, id);
  }

  @Post('me/invitations/:invitationId/decline')
  @RequireUser()
  @HttpCode(204)
  async declineMine(@CurrentUser() user: AuthUser, @Param('invitationId', UuidPipe) id: string) {
    await this.invitations.declineMine(user, id);
  }
}
