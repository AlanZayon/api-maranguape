import mongoose from 'mongoose';

export const RESERVED_SUBDOMAINS = new Set([
  'master',
  'www',
  'app',
  'api',
  'localhost',
  'admin',
  'static',
  'assets',
]);

export function toObjectId(id: unknown) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.Types.ObjectId.isValid(String(id))) {
    return new mongoose.Types.ObjectId(String(id));
  }
  return id;
}

/**
 * Tenant match that tolerates legacy docs where tenantId was stored as a
 * string (Nest multipart migration) instead of ObjectId.
 */
export function tenantFilter(tenantId: string | null | undefined) {
  if (!tenantId) return {};
  const oid = toObjectId(tenantId);
  const asString = String(tenantId);
  if (oid && String(oid) === asString) {
    return { tenantId: { $in: [oid, asString] } };
  }
  return { tenantId: oid ?? asString };
}

/** Expand an id into ObjectId + string forms for $in queries. */
export function idMatchValues(id: unknown): unknown[] {
  if (id == null || id === '') return [];
  if (id instanceof mongoose.Types.ObjectId) {
    return [id, String(id)];
  }
  const asString = String(id);
  const values: unknown[] = [asString];
  if (mongoose.Types.ObjectId.isValid(asString)) {
    values.push(new mongoose.Types.ObjectId(asString));
  }
  return values;
}

export function idsMatchValues(ids: unknown): unknown[] {
  const arr = Array.isArray(ids) ? ids : [ids];
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const id of arr) {
    for (const v of idMatchValues(id)) {
      const key = `${typeof v}:${String(v)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

export function cacheKey(tenantId: string | null | undefined, key: string) {
  return tenantId ? `tenant:${tenantId}:${key}` : key;
}

export function extractSubdomain(
  hostname: string | undefined,
  baseDomain: string,
): string | null {
  if (!hostname) return null;
  const host = String(hostname).split(':')[0].toLowerCase().trim();
  if (!host) return null;

  if (host.endsWith('.localhost') || host === 'localhost') {
    if (host === 'localhost') return null;
    const sub = host.replace(/\.localhost$/, '');
    return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : null;
  }

  if (baseDomain) {
    const base = String(baseDomain).toLowerCase().replace(/^\./, '');
    if (host === base || host === `www.${base}`) return null;
    if (host.endsWith(`.${base}`)) {
      const sub = host.slice(0, -(base.length + 1));
      if (!sub || sub.includes('.')) return null;
      return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
    }
    return null;
  }

  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }
  return null;
}

export function isReservedSubdomain(slug: string | null | undefined) {
  return RESERVED_SUBDOMAINS.has(String(slug || '').toLowerCase());
}
