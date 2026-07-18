const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

/**
 * Requires a valid JWT in the authToken cookie.
 * Attaches req.user = { id, role, username, tenantId? }
 */
function authenticate(req, res, next) {
  const token = req.cookies?.authToken;

  if (!token) {
    return next(new AppError('Não autenticado', 401, 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      username: decoded.username,
      tenantId: decoded.tenantId || null,
    };
    if (decoded.tenantId && !req.tenantId) {
      req.tenantId = String(decoded.tenantId);
    }
    return next();
  } catch {
    return next(new AppError('Sessão inválida ou expirada', 401, 'UNAUTHORIZED'));
  }
}

/**
 * Requires the authenticated user to have one of the given roles.
 * Must be used after authenticate.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Não autenticado', 401, 'UNAUTHORIZED'));
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(new AppError('Acesso negado', 403, 'FORBIDDEN'));
    }

    return next();
  };
}

module.exports = { authenticate, authorize };
