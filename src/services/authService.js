const jwt = require('jsonwebtoken');
const AuthRepository = require('../repositories/authRepository');
const AppError = require('../utils/AppError');

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '24h';
}

function parseExpiresToMs(expiresIn) {
  if (typeof expiresIn === 'number') return expiresIn * 1000;
  const match = String(expiresIn).match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (mult[unit] || 3_600_000);
}

class AuthService {
  static getCookieMaxAge() {
    return parseExpiresToMs(getJwtExpiresIn());
  }

  static async login(id, password, tokenLogin, tenantId = null) {
    const user = await AuthRepository.findUserForLogin(id, tenantId);

    if (!user) {
      throw new AppError('Credenciais incorretas', 401, 'INVALID_CREDENTIALS');
    }

    if (user.role !== 'superadmin' && !user.tenantId) {
      throw new AppError(
        'Usuário sem tenant associado',
        403,
        'TENANT_REQUIRED'
      );
    }

    if (
      tenantId &&
      user.role !== 'superadmin' &&
      String(user.tenantId) !== String(tenantId)
    ) {
      throw new AppError('Credenciais incorretas', 401, 'INVALID_CREDENTIALS');
    }

    // Allow re-login with correct password (replace previous session token)
    // Only block if client sent a stale cookie that doesn't match the stored session
    if (
      tokenLogin &&
      user.lastValidToken &&
      user.lastValidToken !== tokenLogin
    ) {
      // Stale cookie from another session — clear it by issuing a fresh login below
      // after password check (do not block valid credentials)
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Credenciais incorretas', 401, 'INVALID_CREDENTIALS');
    }

    const expiresIn = getJwtExpiresIn();
    const payload = {
      id: user._id,
      role: user.role,
      username: user.username,
      tenantId: user.tenantId ? String(user.tenantId) : null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

    await AuthRepository.updateUserToken(user._id, token);

    return {
      token,
      user: {
        authenticated: true,
        username: user.username,
        role: user.role,
        tenantId: payload.tenantId,
      },
    };
  }

  static async logout(token) {
    if (!token) return;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        decoded = jwt.decode(token);
      } else {
        throw err;
      }
    }

    if (decoded?.id) {
      await AuthRepository.invalidateUserToken(decoded.id);
    }
  }

  static verifyToken(token) {
    if (!token) {
      return { authenticated: false };
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

module.exports = AuthService;
