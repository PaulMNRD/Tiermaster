import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  type CommunityQuery,
  type CreateTierlist,
  type ListTierlistsQuery,
  type TierlistPage,
  TierlistListSchema,
  TierlistPageSchema,
  type TierlistSummary,
  TierlistSummarySchema,
  type UpdateTierlist,
} from '@tiermaster/shared';
import { firstValueFrom } from 'rxjs';

/** Removes undefined / empty values so they are not sent as query parameters. */
export function toParams(query: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)]),
  );
}

@Injectable({ providedIn: 'root' })
export class TierlistsApi {
  private readonly http = inject(HttpClient);

  async listMine(query: Partial<ListTierlistsQuery>): Promise<TierlistSummary[]> {
    const res = await firstValueFrom(this.http.get('/api/tierlists', { params: toParams(query) }));
    return TierlistListSchema.parse(res).items;
  }

  async community(query: Partial<CommunityQuery>): Promise<TierlistPage> {
    return TierlistPageSchema.parse(await firstValueFrom(this.http.get('/api/community', { params: toParams(query) })));
  }

  async create(body: CreateTierlist): Promise<TierlistSummary> {
    return TierlistSummarySchema.parse(await firstValueFrom(this.http.post('/api/tierlists', body)));
  }

  async update(id: string, body: UpdateTierlist): Promise<TierlistSummary> {
    return TierlistSummarySchema.parse(await firstValueFrom(this.http.patch(`/api/tierlists/${id}`, body)));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/tierlists/${id}`));
  }
}
