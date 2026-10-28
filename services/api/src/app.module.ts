import { DynamicModule, Module } from '@nestjs/common';
import { PrismaModule } from './adapters/prisma/prisma.module.js';
import { BroadcasterModule } from './adapters/realtime/broadcaster.module.js';
import type { AppConfig } from './config/app-config.js';
import { ConfigModule } from './config/config.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { TierlistsModule } from './modules/tierlists/tierlists.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({})
export class AppModule {
  static forRoot(config?: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), PrismaModule, BroadcasterModule, HealthModule, UsersModule, AuthModule, TierlistsModule],
    };
  }
}
