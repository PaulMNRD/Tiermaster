import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { TierlistsModule } from '../tierlists/tierlists.module.js';
import { UsersModule } from '../users/users.module.js';
import { InvitationsService } from './invitations.service.js';
import { MembersService } from './members.service.js';
import { SharingController } from './sharing.controller.js';
import { SharingRepository } from './sharing.repository.js';

@Module({
  imports: [AccessModule, TierlistsModule, UsersModule],
  controllers: [SharingController],
  providers: [MembersService, InvitationsService, SharingRepository],
})
export class SharingModule {}
