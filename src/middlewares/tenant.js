const Tenant = require('../models/tenantSchema');

/**
 * Resolves tenant from X-Tenant-Slug header when present.
 * Does NOT fail the request if the slug is unknown — branding/migration
 * can lag behind; authenticated routes still work in single-tenant mode.
 * Strict lookup lives on GET /api/tenants/by-slug/:slug.
 */
async function resolveTenant(req, res, next) {
  try {
    const rawSlug = req.headers['x-tenant-slug'];
    if (!rawSlug) {
      return next();
    }

    const slug = String(rawSlug).toLowerCase().trim();
    if (!slug) {
      return next();
    }

    const tenant = await Tenant.findOne({
      slug,
      status: 'active',
    }).lean();

    if (tenant) {
      req.tenant = tenant;
      req.tenantId = String(tenant._id);
    }
    // Unknown slug: continue without tenant context (legacy / pre-migration)

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Optional helper: merge tenantId into a Mongo query filter.
 */
function withTenantFilter(req, filter = {}) {
  const tenantId = req.tenantId || req.user?.tenantId;
  if (!tenantId) return filter;
  return { ...filter, tenantId };
}

module.exports = { resolveTenant, withTenantFilter };
