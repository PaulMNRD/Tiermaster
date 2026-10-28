import { Injectable } from '@nestjs/common';
import type { Me, PublicUser, UserSearchQuery } from '@tiermaster/shared';
import type { AuthUser } from '../../common/auth.js';
import { conflict, notFound, unauthorized } from '../../common/errors.js';
import { AccessService } from '../access/access.service.js';
import type { User } from '../../generated/prisma/client.js';
import type { OAuthProfile } from '../../ports/auth-provider.port.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly access: AccessService,
  ) {}

  findById(id: string) {
    return this.users.findById(id);
  }

  /** Finds the account linked to this provider identity, or creates it (pseudonym chosen later). */
  async signInWithOAuth(provider: string, profile: OAuthProfile): Promise<User> {
    return (await this.users.findByOAuth(provider, profile.providerUserId)) ?? this.users.createWithOAuth(provider, profile);
  }

  /** Public profile of a user who completed sign-up, or null. */
  async findPublic(id: string): Promise<PublicUser | null> {
    const user = await this.users.findById(id);
    return user?.name ? toPublicUser({ ...user, name: user.name }) : null;
  }

  /**
   * Searches pseudonyms. With `excludeMembersOf`, the caller must be allowed to invite on that tierlist,
   * otherwise 404 (the tierlist may be private).
   */
  async search(user: AuthUser, query: UserSearchQuery): Promise<PublicUser[]> {
    if (query.excludeMembersOf) {
      await this.access.authorize(user, query.excludeMembersOf, 'member.invite').catch(() => {
        throw notFound();
      });
    }
    const rows = await this.users.search(query.q, query.excludeMembersOf);
    return rows.flatMap((row) => (row.name ? [toPublicUser({ ...row, name: row.name })] : []));
  }

  /** Returns the previous avatar key (the caller deletes the object). */
  setAvatarKey(id: string, key: string | null): Promise<string | null> {
    return this.users.setAvatarKey(id, key);
  }

  async avatarKey(id: string): Promise<string | null> {
    return (await this.users.findById(id))?.avatarKey ?? null;
  }

  async getMe(id: string): Promise<Me> {
    const user = await this.users.findById(id);
    if (!user) throw unauthorized();
    return toMe(user);
  }

  async setPseudonym(id: string, name: string): Promise<Me> {
    if (!(await this.users.setName(id, name))) throw conflict('pseudonym_taken');
    return this.getMe(id);
  }
}

export function avatarOf(user: Pick<User, 'id' | 'avatarKey' | 'avatarUrl'>): string | null {
  return user.avatarKey ? `/api/users/${user.id}/avatar?v=${encodeURIComponent(user.avatarKey)}` : user.avatarUrl;
}

export function toPublicUser(user: Pick<User, 'id' | 'avatarKey' | 'avatarUrl'> & { name: string }): PublicUser {
  return { id: user.id, name: user.name, avatarUrl: avatarOf(user) };
}

function toMe(user: User): Me {
  return { id: user.id, name: user.name, email: user.email, avatarUrl: avatarOf(user), needsPseudonym: user.name === null };
}
