import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type Card,
  type Category,
  type CreateCard,
  CreateCardSchema,
  type CreateCategory,
  CreateCategorySchema,
  DeleteQuerySchema,
  type MoveCard,
  MoveCardSchema,
  type MoveCategory,
  MoveCategorySchema,
  type OpsResponse,
  OpsQuerySchema,
  type TierlistSnapshot,
  type UpdateCard,
  UpdateCardSchema,
  type UpdateCategory,
  UpdateCategorySchema,
} from '@tiermaster/shared';
import type { z } from 'zod';
import { type AuthUser, CurrentUser, RequireUser } from '../../common/auth.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { ContentService } from './content.service.js';

type Rev = { rev: number };

@Controller('tierlists/:id')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  /** Snapshot: full state, rev and the caller's effective role. Anonymous visitors allowed on public tierlists. */
  @Get()
  snapshot(@CurrentUser() user: AuthUser | null, @Param('id', UuidPipe) id: string): Promise<TierlistSnapshot> {
    return this.content.snapshot(user, id);
  }

  @Get('ops')
  ops(
    @CurrentUser() user: AuthUser | null,
    @Param('id', UuidPipe) id: string,
    @Query(new ZodPipe(OpsQuerySchema)) query: z.infer<typeof OpsQuerySchema>,
  ): Promise<OpsResponse> {
    return this.content.opsSince(user, id, query.since);
  }

  @Post('categories')
  @RequireUser()
  createCategory(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(CreateCategorySchema)) body: CreateCategory,
  ): Promise<Rev & { category: Category }> {
    return this.content.createCategory(user, id, body);
  }

  @Patch('categories/:categoryId')
  @RequireUser()
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Param('categoryId', UuidPipe) categoryId: string,
    @Body(new ZodPipe(UpdateCategorySchema)) body: UpdateCategory,
  ): Promise<Rev> {
    return this.content.updateCategory(user, id, categoryId, body);
  }

  @Patch('categories/:categoryId/move')
  @RequireUser()
  moveCategory(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Param('categoryId', UuidPipe) categoryId: string,
    @Body(new ZodPipe(MoveCategorySchema)) body: MoveCategory,
  ): Promise<Rev> {
    return this.content.moveCategory(user, id, categoryId, body);
  }

  @Delete('categories/:categoryId')
  @RequireUser()
  deleteCategory(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Param('categoryId', UuidPipe) categoryId: string,
    @Query(new ZodPipe(DeleteQuerySchema)) query: z.infer<typeof DeleteQuerySchema>,
  ): Promise<Rev> {
    return this.content.deleteCategory(user, id, categoryId, query.clientOpId);
  }

  @Post('cards')
  @RequireUser()
  createCard(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(CreateCardSchema)) body: CreateCard,
  ): Promise<Rev & { card: Card }> {
    return this.content.createCard(user, id, body);
  }

  @Patch('cards/:cardId')
  @RequireUser()
  updateCard(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Param('cardId', UuidPipe) cardId: string,
    @Body(new ZodPipe(UpdateCardSchema)) body: UpdateCard,
  ): Promise<Rev> {
    return this.content.updateCard(user, id, cardId, body);
  }

  @Patch('cards/:cardId/move')
  @RequireUser()
  moveCard(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Param('cardId', UuidPipe) cardId: string,
    @Body(new ZodPipe(MoveCardSchema)) body: MoveCard,
  ): Promise<Rev> {
    return this.content.moveCard(user, id, cardId, body);
  }

  @Delete('cards/:cardId')
  @RequireUser()
  async deleteCard(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Param('cardId', UuidPipe) cardId: string,
    @Query(new ZodPipe(DeleteQuerySchema)) query: z.infer<typeof DeleteQuerySchema>,
  ): Promise<Rev> {
    const { rev } = await this.content.deleteCard(user, id, cardId, query.clientOpId);
    return { rev };
  }
}
