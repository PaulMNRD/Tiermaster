import { Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { AuthProvidersResponse, SocketTokenResponse } from '@tiermaster/shared';
import type { CookieOptions, Request, Response } from 'express';
import { type AuthUser, CurrentUser, RequireUser } from '../../common/auth.js';
import { readCookie } from '../../common/cookies.js';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { AuthService, OAUTH_STATE_TTL_SECONDS, SESSION_TTL_SECONDS } from './auth.service.js';
import { SESSION_COOKIE } from './session.guard.js';

const OAUTH_COOKIE = 'tm_oauth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('providers')
  providers(): AuthProvidersResponse {
    return { providers: this.auth.enabledProviders() };
  }

  @Get('socket-token')
  @RequireUser()
  socketToken(@CurrentUser() user: AuthUser): SocketTokenResponse {
    return { token: this.auth.socketToken(user.id) };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  @Get(':provider')
  start(
    @Param('provider') provider: string,
    @Query('returnTo') returnTo: unknown,
    @Query('loginHint') loginHint: unknown,
    @Res() res: Response,
  ): void {
    const { url, stateCookie } = this.auth.start(provider, returnTo, typeof loginHint === 'string' ? loginHint : undefined);
    res.cookie(OAUTH_COOKIE, stateCookie, { ...this.cookieOptions(), maxAge: OAUTH_STATE_TTL_SECONDS * 1000 });
    res.redirect(302, url);
  }

  @Get(':provider/callback')
  async callback(@Param('provider') provider: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const query = Object.fromEntries(Object.entries(req.query).filter((e): e is [string, string] => typeof e[1] === 'string'));
    const result = await this.auth.finish(provider, query, readCookie(req, OAUTH_COOKIE));
    res.clearCookie(OAUTH_COOKIE, this.cookieOptions());
    if ('error' in result) {
      res.redirect(302, this.auth.publicUrl(`/login?error=${result.error}`));
      return;
    }
    res.cookie(SESSION_COOKIE, result.sessionToken, { ...this.cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
    res.redirect(302, this.auth.publicUrl(result.redirect));
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.config.COOKIE_SECURE, path: '/' };
  }
}
