import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type CommunityQuery,
  CommunityQuerySchema,
  type CreateTierlist,
  CreateTierlistSchema,
  type ListTierlistsQuery,
  ListTierlistsQuerySchema,
  type TierlistList,
  type TierlistPage,
  type TierlistSummary,
  type UpdateTierlist,
  UpdateTierlistSchema,
} from '@tiermaster/shared';
import { type AuthUser, CurrentUser, RequireUser } from '../../common/auth.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { TierlistsService } from './tierlists.service.js';

@Controller()
export class TierlistsController {
  constructor(private readonly tierlists: TierlistsService) {}

  @Post('tierlists')
  @RequireUser()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateTierlistSchema)) body: CreateTierlist): Promise<TierlistSummary> {
    return this.tierlists.create(user, body);
  }

  /** Home: owned and shared tierlists, with the role on each. */
  @Get('tierlists')
  @RequireUser()
  async list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ListTierlistsQuerySchema)) query: ListTierlistsQuery): Promise<TierlistList> {
    return { items: await this.tierlists.listMine(user, query) };
  }

  @Get('community')
  community(@CurrentUser() user: AuthUser | null, @Query(new ZodPipe(CommunityQuerySchema)) query: CommunityQuery): Promise<TierlistPage> {
    return this.tierlists.listCommunity(user, query);
  }

  @Patch('tierlists/:id')
  @RequireUser()
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(UpdateTierlistSchema)) body: UpdateTierlist,
  ): Promise<TierlistSummary & { rev: number }> {
    const { rev } = await this.tierlists.update(user, id, body);
    return { ...(await this.tierlists.summary(user, id)), rev };
  }

  @Delete('tierlists/:id')
  @RequireUser()
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<void> {
    await this.tierlists.delete(user, id);
  }
}
