const jwt = require('jsonwebtoken');
const Tenant = require('../models/tenantSchema');
const {
  extractSubdomain,
  isReservedSubdomain,
} = require('../utils/tenantHelpers');

const SLUG_TTL_MS = 60_000;
/** @type {Map<string, { tenant: object, expiresAt: number }>} */
const slugTenantCache = new Map();

async function findTenantBySlug(slug) {
  const cached = slugTenantCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  const tenant = await Tenant.findOne({
    slug,
    status: 'active',
  }).lean();

  if (tenant) {
    slugTenantCache.set(slug, {
      tenant,
      expiresAt: Date.now() + SLUG_TTL_MS,
    });
  } else {
    slugTenantCache.delete(slug);
  }

  return tenant;
}

function resolveSlugFromRequest(req) {
  const rawSlug = req.headers['x-tenant-slug'];
  if (rawSlug) {
    return String(rawSlug).toLowerCase().trim();
  }

  const baseDomain = process.env.BASE_DOMAIN || '';
  const hostHeader =
    req.headers['x-forwarded-host'] || req.headers.host || '';
  const origin = req.headers.origin || '';
  let hostname = hostHeader.split(',')[0].trim();
  if (origin) {
    try {
      hostname = new URL(origin).hostname;
    } catch {
      // keep host header
    }
  }
  return extractSubdomain(hostname, baseDomain);
}

/**
 * Resolves tenant from:
 * 1. JWT cookie tenantId (skip DB when present)
 * 2. X-Tenant-Slug header (preferred for slug)
 * 3. Origin / X-Forwarded-Host / Host subdomain
 *
 * Reserved subdomains (master, www, api, …) leave req without municipal tenant.
 * Unknown slug: continue without tenant (public branding uses strict by-slug).
 */
async function resolveTenant(req, res, next) {
  try {
    const token = req.cookies?.authToken;
    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.tenantId) {
          req.tenantId = String(decoded.tenantId);
          return next();
        }
      } catch {
        // Invalid/expired token — fall through to slug resolution
      }
    }

    const slug = resolveSlugFromRequest(req);

    if (!slug || isReservedSubdomain(slug)) {
      return next();
    }

    const tenant = await findTenantBySlug(slug);

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

module.exports = {
  resolveTenant,
  withTenantFilter,
  findTenantBySlug,
};
