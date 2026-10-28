import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  CardSchema,
  CategorySchema,
  type CreateCard,
  type CreateCategory,
  type MoveCard,
  type MoveCategory,
  type OpsResponse,
  OpsResponseSchema,
  type TierlistSnapshot,
  TierlistSnapshotSchema,
  type UpdateCard,
  type UpdateCategory,
  type UpdateTierlist,
  WriteResultSchema,
} from '@tiermaster/shared';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

const CardWriteSchema = WriteResultSchema.extend({ card: CardSchema });
const CategoryWriteSchema = WriteResultSchema.extend({ category: CategorySchema });

/** REST client for the content of one tierlist. Every write returns the rev assigned by the server. */
@Injectable({ providedIn: 'root' })
export class ContentApi {
  private readonly http = inject(HttpClient);

  async snapshot(id: string): Promise<TierlistSnapshot> {
    return TierlistSnapshotSchema.parse(await firstValueFrom(this.http.get(`/api/tierlists/${id}`)));
  }

  async opsSince(id: string, since: number): Promise<OpsResponse> {
    return OpsResponseSchema.parse(await firstValueFrom(this.http.get(`/api/tierlists/${id}/ops`, { params: { since } })));
  }

  createCard(id: string, body: CreateCard) {
    return this.send(CardWriteSchema, this.http.post(`/api/tierlists/${id}/cards`, body));
  }

  updateCard(id: string, cardId: string, body: UpdateCard) {
    return this.send(WriteResultSchema, this.http.patch(`/api/tierlists/${id}/cards/${cardId}`, body));
  }

  moveCard(id: string, cardId: string, body: MoveCard) {
    return this.send(WriteResultSchema, this.http.patch(`/api/tierlists/${id}/cards/${cardId}/move`, body));
  }

  deleteCard(id: string, cardId: string, clientOpId: string) {
    return this.send(WriteResultSchema, this.http.delete(`/api/tierlists/${id}/cards/${cardId}`, { params: { clientOpId } }));
  }

  createCategory(id: string, body: CreateCategory) {
    return this.send(CategoryWriteSchema, this.http.post(`/api/tierlists/${id}/categories`, body));
  }

  updateCategory(id: string, categoryId: string, body: UpdateCategory) {
    return this.send(WriteResultSchema, this.http.patch(`/api/tierlists/${id}/categories/${categoryId}`, body));
  }

  moveCategory(id: string, categoryId: string, body: MoveCategory) {
    return this.send(WriteResultSchema, this.http.patch(`/api/tierlists/${id}/categories/${categoryId}/move`, body));
  }

  deleteCategory(id: string, categoryId: string, clientOpId: string) {
    return this.send(WriteResultSchema, this.http.delete(`/api/tierlists/${id}/categories/${categoryId}`, { params: { clientOpId } }));
  }

  /** Rename (or change the default role); the answer also carries the summary, only the rev matters here. */
  renameTierlist(id: string, body: UpdateTierlist) {
    return this.send(WriteResultSchema, this.http.patch(`/api/tierlists/${id}`, body));
  }

  private async send<S extends z.ZodType>(schema: S, request: ReturnType<HttpClient['get']>): Promise<z.infer<S>> {
    return schema.parse(await firstValueFrom(request));
  }
}
