const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { findTenantBySlug } = require('./tenant');

/** Tenant elevated: dashboard, cargos, referências, deletes, branding */
const TENANT_ELEVATED = ['owner', 'admin', 'superadmin'];

/** Staff who can mutate estrutura/funcionários (not delete) */
const TENANT_STAFF = ['owner', 'admin', 'user'];

/** Can manage tenant user accounts */
const USERS_MANAGERS = ['owner', 'superadmin'];

/**
 * Requires a valid JWT in the authToken cookie.
 * Attaches req.user = { id, role, username, tenantId? }
 * Non-superadmin users must have a tenantId (fail-closed).
 * Superadmins may set X-Act-As-Tenant (slug) to scope requests.
 */
async function authenticate(req, res, next) {
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

    const isSuperadmin = decoded.role === 'superadmin';

    if (!isSuperadmin && !decoded.tenantId) {
      return next(
        new AppError(
          'Usuário sem tenant associado',
          403,
          'TENANT_REQUIRED'
        )
      );
    }

    if (decoded.tenantId && !req.tenantId) {
      req.tenantId = String(decoded.tenantId);
    }

    // Superadmin explicit "view as tenant"
    if (isSuperadmin) {
      const actAs =
        req.headers['x-act-as-tenant'] ||
        req.query.actAs ||
        null;
      if (actAs) {
        const slug = String(actAs).toLowerCase().trim();
        const tenant = await findTenantBySlug(slug);
        if (!tenant) {
          return next(
            new AppError(
              'Tenant para impersonação não encontrado',
              404,
              'ACT_AS_TENANT_NOT_FOUND'
            )
          );
        }
        req.tenant = tenant;
        req.tenantId = String(tenant._id);
        req.actingAsTenant = true;
      }
    }

    return next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
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

module.exports = {
  authenticate,
  authorize,
  TENANT_ELEVATED,
  TENANT_STAFF,
  USERS_MANAGERS,
};
