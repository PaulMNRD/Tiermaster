import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DiscordAuthProvider } from '../../adapters/auth/discord-auth.provider.js';
import { FakeAuthProvider } from '../../adapters/auth/fake-auth.provider.js';
import { GoogleAuthProvider } from '../../adapters/auth/google-auth.provider.js';
import { SteamAuthProvider } from '../../adapters/auth/steam-auth.provider.js';
import { RateLimitGuard } from '../../common/rate-limit.js';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { AUTH_PROVIDERS, type AuthProvider } from '../../ports/auth-provider.port.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

/** Providers are enabled by configuration: an adapter without credentials is simply not offered. */
function authProviders(config: AppConfig): AuthProvider[] {
  const providers: AuthProvider[] = [];
  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
    providers.push(new GoogleAuthProvider(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET));
  }
  if (config.DISCORD_CLIENT_ID && config.DISCORD_CLIENT_SECRET) {
    providers.push(new DiscordAuthProvider(config.DISCORD_CLIENT_ID, config.DISCORD_CLIENT_SECRET));
  }
  if (config.STEAM_API_KEY) providers.push(new SteamAuthProvider(config.STEAM_API_KEY));
  if (config.AUTH_FAKE_ENABLED) providers.push(new FakeAuthProvider());
  return providers;
}

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    { provide: AUTH_PROVIDERS, useFactory: authProviders, inject: [APP_CONFIG] },
    // Global guards run in this order: the rate limiter needs the user attached by the session guard.
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
