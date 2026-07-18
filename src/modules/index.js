/**
 * Domain module map (logical architecture).
 *
 * Physical layout today remains layered (routes → controllers → services →
 * repositories → models) for stability. New features should follow this map:
 *
 * modules/
 *   auth/          login, users, roles
 *   setores/       hierarchy / organograma nodes
 *   funcionarios/  employees, cargos, reports, CSV
 *   search/        autocomplete / full-text
 *   referencias/   reference catalog
 *   tenants/       multi-tenant branding & CRUD
 *   dashboard/     aggregated metrics
 *   audit/         action log
 *
 * shared/
 *   config/        mongo, redis, aws, multer
 *   middlewares/   auth, tenant, validate, errors, metrics
 *   utils/         logger, AppError, normalizarTexto, awsUtils
 *   services/      CacheService (cross-cutting)
 *
 * Migration path: move each domain's files into modules/<name>/ when touching
 * that domain, then update requires — avoid big-bang moves.
 */
module.exports = {
  domains: [
    'auth',
    'setores',
    'funcionarios',
    'search',
    'referencias',
    'tenants',
    'dashboard',
    'audit',
  ],
};
