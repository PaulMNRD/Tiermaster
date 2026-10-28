import { Injectable } from '@nestjs/common';
import type { Me } from '@tiermaster/shared';
import { conflict, unauthorized } from '../../common/errors.js';
import type { User } from '../../generated/prisma/client.js';
import type { OAuthProfile } from '../../ports/auth-provider.port.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  findById(id: string) {
    return this.users.findById(id);
  }

  /** Finds the account linked to this provider identity, or creates it (pseudonym chosen later). */
  async signInWithOAuth(provider: string, profile: OAuthProfile): Promise<User> {
    return (await this.users.findByOAuth(provider, profile.providerUserId)) ?? this.users.createWithOAuth(provider, profile);
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

function toMe(user: User): Me {
  return { id: user.id, name: user.name, email: user.email, avatarUrl: avatarOf(user), needsPseudonym: user.name === null };
}
