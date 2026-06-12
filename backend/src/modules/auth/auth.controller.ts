import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { IsBoolean, IsString, IsUUID, MinLength } from 'class-validator';
import { Response } from 'express';
import { CurrentSession, Public } from './auth.decorators';
import { AuthService } from './auth.service';
import { SessionContext } from './auth.types';

class LoginBody {
  @IsString()
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsBoolean()
  remember!: boolean;
}

class SwitchTenantBody {
  @IsUUID()
  tenantId!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: LoginBody,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(
      body.identifier,
      body.password,
      body.remember,
    );
    response.cookie('mvp_session', session.token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: session.maxAgeMs,
    });

    return { success: true };
  }

  @Get('me')
  me(@CurrentSession() session: SessionContext) {
    return session;
  }

  @Post('switch-tenant')
  async switchTenant(
    @Body() body: SwitchTenantBody,
    @CurrentSession() session: SessionContext,
  ) {
    await this.authService.switchTenant(
      session.sessionId,
      session.user.id,
      body.tenantId,
    );
    return { success: true };
  }

  @Post('logout')
  async logout(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(session.sessionId);
    response.clearCookie('mvp_session', { path: '/' });
    return { success: true };
  }
}
