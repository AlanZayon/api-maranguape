const mongoose = require('mongoose');
const {
  getBrandingPolicy,
  COLOR_FIELDS,
} = require('../config/brandingPolicy');

const RESERVED_SUBDOMAINS = new Set([
  'master',
  'www',
  'app',
  'api',
  'localhost',
  'admin',
  'static',
  'assets',
]);

/** @deprecated Use getBrandingPolicy().customCssMaxLength */
const CUSTOM_CSS_MAX_LENGTH = 20_000;

const CSS_COLOR_RE =
  /^(#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|[a-z]+)$/i;

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

function tenantFilter(tenantId) {
  if (!tenantId) return {};
  return { tenantId: toObjectId(tenantId) };
}

function cacheKey(tenantId, key) {
  return tenantId ? `tenant:${tenantId}:${key}` : key;
}

function extractSubdomain(hostname, baseDomain) {
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

function isReservedSubdomain(slug) {
  return RESERVED_SUBDOMAINS.has(String(slug || '').toLowerCase());
}

function isPlatformHost(hostname, baseDomain, masterSubdomain = 'master') {
  if (!hostname) return false;
  const host = String(hostname).split(':')[0].toLowerCase().trim();
  const master = String(masterSubdomain || 'master').toLowerCase();

  if (host === `${master}.localhost` || host.startsWith(`${master}.`)) {
    return true;
  }

  if (baseDomain) {
    const base = String(baseDomain).toLowerCase().replace(/^\./, '');
    return host === `${master}.${base}`;
  }

  return false;
}

function isValidCssColor(value) {
  if (value == null || value === '') return false;
  return CSS_COLOR_RE.test(String(value).trim());
}

function sanitizeColor(value, fallback) {
  if (value == null || value === '') return fallback;
  const v = String(value).trim();
  return isValidCssColor(v) ? v : fallback;
}

function sanitizeFontUrl(fontUrl) {
  if (fontUrl == null || fontUrl === '') return null;
  const raw = String(fontUrl).trim();
  if (!raw) return null;

  const policy = getBrandingPolicy();
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  const allowed = policy.fontUrlHosts.map((h) => h.toLowerCase());
  if (!allowed.length) return raw;
  const ok = allowed.some(
    (h) => host === h || host.endsWith(`.${h}`)
  );
  return ok ? raw : null;
}

function selectorAllowed(selector, allowedPrefixes) {
  const s = String(selector || '').trim();
  if (!s) return false;
  // Allow :root / html / body only when scoped under allowed prefixes elsewhere —
  // for custom CSS we require a matching allowlist prefix.
  if (s.startsWith('@')) return false;
  return allowedPrefixes.some((prefix) => {
    const p = prefix.trim();
    if (!p) return false;
    return s === p || s.startsWith(`${p}`) || s.startsWith(`${p}.`) || s.startsWith(`${p}:`) || s.startsWith(`${p}[`) || s.startsWith(`${p} `);
  });
}

/**
 * Filter CSS rules so only selectors matching the allowlist prefixes remain.
 * Handles simple top-level rules; nested @media blocks keep only allowed inner rules.
 */
function filterCssBySelectorAllowlist(css, allowedPrefixes) {
  if (!css || !allowedPrefixes?.length) return css;

  const out = [];
  let i = 0;
  const src = String(css);

  while (i < src.length) {
    // Skip whitespace / comments
    if (/\s/.test(src[i])) {
      i += 1;
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) break;
      out.push(src.slice(i, end + 2));
      i = end + 2;
      continue;
    }

    // @-rules (media, etc.)
    if (src[i] === '@') {
      const brace = src.indexOf('{', i);
      if (brace === -1) break;
      const header = src.slice(i, brace).trim();
      let depth = 1;
      let j = brace + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') depth -= 1;
        j += 1;
      }
      const inner = src.slice(brace + 1, j - 1);
      // Only allow @media / @supports; drop @import (already blocked) and others
      if (/^@(media|supports)\b/i.test(header)) {
        const filteredInner = filterCssBySelectorAllowlist(inner, allowedPrefixes);
        if (filteredInner.trim()) {
          out.push(`${header} { ${filteredInner} }`);
        }
      }
      i = j;
      continue;
    }

    // Normal rule: selectors { body }
    const brace = src.indexOf('{', i);
    if (brace === -1) break;
    const selectorsRaw = src.slice(i, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') depth -= 1;
      j += 1;
    }
    const body = src.slice(brace + 1, j - 1);
    const kept = selectorsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => selectorAllowed(s, allowedPrefixes));
    if (kept.length) {
      out.push(`${kept.join(', ')} { ${body.trim()} }`);
    }
    i = j;
  }

  return out.join('\n');
}

/**
 * Sanitize tenant custom CSS — strip dangerous constructs; enforce allowlist + max length.
 */
function sanitizeCustomCss(css) {
  const policy = getBrandingPolicy();
  if (!policy.customCssEnabled) return null;
  if (css == null || css === '') return null;

  let value = String(css);
  if (value.length > policy.customCssMaxLength) {
    value = value.slice(0, policy.customCssMaxLength);
  }

  value = value
    .replace(/<\/?script[^>]*>/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(')
    .replace(/@import\b/gi, '/* @import blocked */')
    .replace(/behavior\s*:/gi, '/* behavior blocked */:')
    .replace(/-moz-binding\s*:/gi, '/* binding blocked */:');

  value = filterCssBySelectorAllowlist(value, policy.allowedSelectors);
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Keep only editable branding keys from policy; apply color/font sanitization.
 */
function filterEditableBranding(incoming = {}) {
  const policy = getBrandingPolicy();
  const allowed = new Set(policy.editableFields);
  const out = {};

  for (const [key, val] of Object.entries(incoming || {})) {
    if (!allowed.has(key)) continue;
    if (val === undefined) continue;

    if (key === 'customCss') {
      out.customCss = sanitizeCustomCss(val);
      continue;
    }
    if (key === 'fontUrl') {
      out.fontUrl = sanitizeFontUrl(val);
      continue;
    }
    if (COLOR_FIELDS.has(key)) {
      // null secondary is allowed; others keep raw and sanitize later with defaults
      out[key] = val;
      continue;
    }
    out[key] = val;
  }

  return out;
}

function mergeBranding(existing = {}, incoming = {}) {
  const filtered = filterEditableBranding(incoming);
  const out = { ...(existing || {}) };

  for (const [key, val] of Object.entries(filtered)) {
    if (val === undefined) continue;
    out[key] = val;
  }

  // If CSS disabled, never keep writing new CSS from client; clear on explicit disable
  const policy = getBrandingPolicy();
  if (!policy.customCssEnabled) {
    // Keep existing stored CSS for rollback when re-enabled, unless incoming tried to clear —
    // plan says: reject/ignore updates → do not accept new customCss
  }

  return out;
}

function stripCustomCssIfDisabled(branding) {
  const policy = getBrandingPolicy();
  if (!branding) return branding;
  if (policy.customCssEnabled) return branding;
  const copy = { ...branding };
  delete copy.customCss;
  return copy;
}

module.exports = {
  RESERVED_SUBDOMAINS,
  CUSTOM_CSS_MAX_LENGTH,
  toObjectId,
  tenantFilter,
  cacheKey,
  extractSubdomain,
  isReservedSubdomain,
  isPlatformHost,
  isValidCssColor,
  sanitizeColor,
  sanitizeFontUrl,
  sanitizeCustomCss,
  filterEditableBranding,
  mergeBranding,
  stripCustomCssIfDisabled,
  filterCssBySelectorAllowlist,
};
