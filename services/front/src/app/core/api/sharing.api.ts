import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AcceptInvitationResponseSchema,
  type CreateInvitation,
  CreateInvitationResponseSchema,
  InvitationPreviewSchema,
  InvitationsResponseSchema,
  type MemberRole,
  MembersResponseSchema,
  MyInvitationsResponseSchema,
  UserSearchResponseSchema,
  WriteResultSchema,
} from '@tiermaster/shared';
import { firstValueFrom } from 'rxjs';
import { toParams } from './tierlists.api';

@Injectable({ providedIn: 'root' })
export class SharingApi {
  private readonly http = inject(HttpClient);

  async members(tierlistId: string) {
    return MembersResponseSchema.parse(await firstValueFrom(this.http.get(`/api/tierlists/${tierlistId}/members`))).members;
  }

  async changeRole(tierlistId: string, userId: string, role: MemberRole) {
    return WriteResultSchema.parse(await firstValueFrom(this.http.patch(`/api/tierlists/${tierlistId}/members/${userId}`, { role })));
  }

  async removeMember(tierlistId: string, userId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/tierlists/${tierlistId}/members/${userId}`));
  }

  async leave(tierlistId: string): Promise<void> {
    await firstValueFrom(this.http.post(`/api/tierlists/${tierlistId}/leave`, {}));
  }

  async searchUsers(q: string, excludeMembersOf?: string) {
    const res = await firstValueFrom(this.http.get('/api/users/search', { params: toParams({ q, excludeMembersOf }) }));
    return UserSearchResponseSchema.parse(res).users;
  }

  async invite(tierlistId: string, body: CreateInvitation) {
    return CreateInvitationResponseSchema.parse(await firstValueFrom(this.http.post(`/api/tierlists/${tierlistId}/invitations`, body)));
  }

  async invitations(tierlistId: string) {
    return InvitationsResponseSchema.parse(await firstValueFrom(this.http.get(`/api/tierlists/${tierlistId}/invitations`))).invitations;
  }

  async revokeInvitation(tierlistId: string, invitationId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/tierlists/${tierlistId}/invitations/${invitationId}`));
  }

  async preview(token: string) {
    return InvitationPreviewSchema.parse(await firstValueFrom(this.http.get(`/api/invitations/${token}`)));
  }

  async acceptLink(token: string) {
    return AcceptInvitationResponseSchema.parse(await firstValueFrom(this.http.post(`/api/invitations/${token}/accept`, {})));
  }

  async myInvitations() {
    return MyInvitationsResponseSchema.parse(await firstValueFrom(this.http.get('/api/me/invitations'))).invitations;
  }

  async acceptMine(invitationId: string) {
    return AcceptInvitationResponseSchema.parse(await firstValueFrom(this.http.post(`/api/me/invitations/${invitationId}/accept`, {})));
  }

  async declineMine(invitationId: string): Promise<void> {
    await firstValueFrom(this.http.post(`/api/me/invitations/${invitationId}/decline`, {}));
  }
}
