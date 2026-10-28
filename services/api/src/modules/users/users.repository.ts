import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../adapters/prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { OAuthProfile } from '../../ports/auth-provider.port.js';

export const SEARCH_LIMIT = 10;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByOAuth(provider: string, providerUserId: string) {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: true },
    });
    return account?.user ?? null;
  }

  createWithOAuth(provider: string, profile: OAuthProfile) {
    return this.prisma.user.create({
      data: {
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        oauthAccounts: { create: { provider, providerUserId: profile.providerUserId } },
      },
    });
  }

  /** Returns false when the pseudonym is already taken. */
  async setName(id: string, name: string): Promise<boolean> {
    try {
      await this.prisma.user.update({ where: { id }, data: { name, nameKey: name.toLowerCase() } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }

  /** Pseudonym search (partial, case-insensitive). Email is never searched. */
  search(q: string, excludeMembersOf?: string) {
    return this.prisma.user.findMany({
      where: {
        nameKey: { contains: q.toLowerCase() },
        ...(excludeMembersOf
          ? { memberships: { none: { tierlistId: excludeMembersOf } }, ownedTierlists: { none: { id: excludeMembersOf } } }
          : {}),
      },
      orderBy: { nameKey: 'asc' },
      take: SEARCH_LIMIT,
      select: { id: true, name: true, avatarKey: true, avatarUrl: true },
    });
  }
}
