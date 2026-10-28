import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { TierlistGateway } from './tierlist.gateway.js';

@Module({ imports: [AccessModule, AuthModule, UsersModule], providers: [TierlistGateway] })
export class RealtimeModule {}
