import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';

type LoginBody = { id: string; password: string };

/** Ports legacy/controllers/authController.js — mounted at /api/usuarios. */
@Controller('api/usuarios')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private authCookieOptions(): CookieOptions {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    };
  }

  @Post('login')
  async login(
    @Body() body: LoginBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, password } = body || {};
    const tokenLogin = req.cookies?.authToken;

    const { token, user } = await this.authService.login(
      id,
      password,
      tokenLogin,
      req.tenantId || null,
    );

    res.cookie('authToken', token, {
      ...this.authCookieOptions(),
      maxAge: this.authService.getCookieMaxAge(),
    });

    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.authToken;
    await this.authService.logout(token);
    res.clearCookie('authToken', this.authCookieOptions());
    return { message: 'Logout realizado com sucesso!' };
  }

  @Get('verify')
  verify(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.authToken;
    const result = this.authService.verifyToken(token);
    res.status(result.authenticated ? HttpStatus.OK : HttpStatus.UNAUTHORIZED);
    return result;
  }
}
