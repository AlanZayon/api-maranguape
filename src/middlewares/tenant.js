const Tenant = require('../models/tenantSchema');
const {
  extractSubdomain,
  isReservedSubdomain,
} = require('../utils/tenantHelpers');

/**
 * Resolves tenant from:
 * 1. X-Tenant-Slug header (preferred)
 * 2. Origin / X-Forwarded-Host / Host subdomain
 *
 * Reserved subdomains (master, www, api, …) leave req without municipal tenant.
 * Unknown slug: continue without tenant (public branding uses strict by-slug).
 */
async function resolveTenant(req, res, next) {
  try {
    let slug = null;

    const rawSlug = req.headers['x-tenant-slug'];
    if (rawSlug) {
      slug = String(rawSlug).toLowerCase().trim();
    }

    if (!slug) {
      const baseDomain = process.env.BASE_DOMAIN || '';
      const hostHeader =
        req.headers['x-forwarded-host'] ||
        req.headers.host ||
        '';
      const origin = req.headers.origin || '';
      let hostname = hostHeader.split(',')[0].trim();
      if (origin) {
        try {
          hostname = new URL(origin).hostname;
        } catch {
          // keep host header
        }
      }
      slug = extractSubdomain(hostname, baseDomain);
    }

    if (!slug || isReservedSubdomain(slug)) {
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

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Merge tenantId into a Mongo query filter (fail-open only when no tenant).
 */
function withTenantFilter(req, filter = {}) {
  const tenantId = req.tenantId || req.user?.tenantId;
  if (!tenantId) return filter;
  return { ...filter, tenantId };
}

module.exports = { resolveTenant, withTenantFilter };
