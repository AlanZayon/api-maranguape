import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AppError } from '../../common/errors/app-error';
import { AuthRepository } from './auth.repository';

type JwtPayload = {
  id: string;
  role: string;
  username: string;
  tenantId: string | null;
};

type DecodedToken = JwtPayload & { id?: string };

type LoginResult = {
  token: string;
  user: {
    authenticated: true;
    username: string;
    role: string;
    tenantId: string | null;
  };
};

type VerifyResult =
  | {
      authenticated: true;
      username: string;
      role: string;
      tenantId: string | null;
      id: string;
    }
  | { authenticated: false };

/** Ports legacy/services/authService.js. */
@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {}

  private getJwtSecret(): string {
    return this.config.get<string>('JWT_SECRET') || '';
  }

  private getJwtExpiresIn(): string {
    return this.config.get<string>('JWT_EXPIRES_IN') || '24h';
  }

  private parseExpiresToMs(expiresIn: string | number): number {
    if (typeof expiresIn === 'number') return expiresIn * 1000;
    const match = /^(\d+)([smhd])$/.exec(String(expiresIn));
    if (!match) return 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    const unit = match[2];
    const mult: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return n * (mult[unit] || 3_600_000);
  }

  getCookieMaxAge(): number {
    return this.parseExpiresToMs(this.getJwtExpiresIn());
  }

  async login(
    id: string,
    password: string,
    tokenLogin: string | undefined,
    tenantId: string | null = null,
  ): Promise<LoginResult> {
    const user = await this.authRepository.findUserForLogin(id, tenantId);

    if (!user) {
      throw new AppError('Credenciais incorretas', 401, 'INVALID_CREDENTIALS');
    }

    if (user.role !== 'superadmin' && !user.tenantId) {
      throw new AppError(
        'Usuário sem tenant associado',
        403,
        'TENANT_REQUIRED',
      );
    }

    if (
      tenantId &&
      user.role !== 'superadmin' &&
      String(user.tenantId) !== String(tenantId)
    ) {
      throw new AppError('Credenciais incorretas', 401, 'INVALID_CREDENTIALS');
    }

    // Allow re-login with correct password (replaces previous session token).
    // Only a stale cookie from another session would differ from
    // `lastValidToken`; we don't block on that here — the password check
    // below is authoritative, matching legacy behavior exactly.
    void tokenLogin;

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Credenciais incorretas', 401, 'INVALID_CREDENTIALS');
    }

    const expiresIn = this.getJwtExpiresIn();
    const tenantIdStr = user.tenantId ? String(user.tenantId) : null;
    const payload: JwtPayload = {
      id: String(user._id),
      role: user.role,
      username: user.username,
      tenantId: tenantIdStr,
    };

    const token = jwt.sign(payload, this.getJwtSecret(), {
      expiresIn,
    } as jwt.SignOptions);

    await this.authRepository.updateUserToken(String(user._id), token);

    return {
      token,
      user: {
        authenticated: true,
        username: user.username,
        role: user.role,
        tenantId: tenantIdStr,
      },
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;

    let decoded: DecodedToken | null = null;
    try {
      decoded = jwt.verify(token, this.getJwtSecret()) as DecodedToken;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        decoded = jwt.decode(token) as DecodedToken | null;
      } else {
        throw err;
      }
    }

    if (decoded?.id) {
      await this.authRepository.invalidateUserToken(decoded.id);
    }
  }

  verifyToken(token: string | undefined): VerifyResult {
    if (!token) {
      return { authenticated: false };
    }

    try {
      const decoded = jwt.verify(
        token,
        this.getJwtSecret(),
      ) as unknown as JwtPayload;
      return {
        authenticated: true,
        username: decoded.username,
        role: decoded.role,
        tenantId: decoded.tenantId || null,
        id: decoded.id,
      };
    } catch {
      return { authenticated: false };
    }
  }
}
