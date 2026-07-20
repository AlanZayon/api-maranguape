import { BrandingPolicy } from '../../config/branding-policy.service';

export const COLOR_FIELDS = new Set([
  'primaryColor',
  'secondaryColor',
  'primaryContrast',
  'headerBg',
  'headerText',
  'sidebarBg',
  'sidebarText',
  'surfaceBg',
  'pageBg',
  'textColor',
  'mutedColor',
  'borderColor',
]);

const CSS_COLOR_RE =
  /^(#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|[a-z]+)$/i;

export function isValidCssColor(value: unknown): boolean {
  if (value == null || value === '') return false;
  return CSS_COLOR_RE.test(String(value).trim());
}

export function sanitizeColor(
  value: unknown,
  fallback: string | null,
): string | null {
  if (value == null || value === '') return fallback;
  const v = String(value).trim();
  return isValidCssColor(v) ? v : fallback;
}

export function sanitizeFontUrl(
  fontUrl: unknown,
  policy: BrandingPolicy,
): string | null {
  if (fontUrl == null || fontUrl === '') return null;
  const raw = String(fontUrl).trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  const allowed = policy.fontUrlHosts.map((h) => h.toLowerCase());
  if (!allowed.length) return raw;
  const ok = allowed.some((h) => host === h || host.endsWith(`.${h}`));
  return ok ? raw : null;
}

function selectorAllowed(selector: string, allowedPrefixes: string[]) {
  const s = String(selector || '').trim();
  if (!s) return false;
  if (s.startsWith('@')) return false;
  return allowedPrefixes.some((prefix) => {
    const p = prefix.trim();
    if (!p) return false;
    return (
      s === p ||
      s.startsWith(`${p}`) ||
      s.startsWith(`${p}.`) ||
      s.startsWith(`${p}:`) ||
      s.startsWith(`${p}[`) ||
      s.startsWith(`${p} `)
    );
  });
}

/**
 * Filter CSS rules so only selectors matching the allowlist prefixes remain.
 * Handles simple top-level rules; nested @media blocks keep only allowed inner rules.
 */
export function filterCssBySelectorAllowlist(
  css: string | null | undefined,
  allowedPrefixes: string[],
): string {
  if (!css || !allowedPrefixes?.length) return css || '';

  const out: string[] = [];
  let i = 0;
  const src = String(css);

  while (i < src.length) {
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
      if (/^@(media|supports)\b/i.test(header)) {
        const filteredInner = filterCssBySelectorAllowlist(
          inner,
          allowedPrefixes,
        );
        if (filteredInner.trim()) {
          out.push(`${header} { ${filteredInner} }`);
        }
      }
      i = j;
      continue;
    }

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
export function sanitizeCustomCss(
  css: unknown,
  policy: BrandingPolicy,
): string | null {
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
export function filterEditableBranding(
  incoming: Record<string, unknown> = {},
  policy: BrandingPolicy,
): Record<string, unknown> {
  const allowed = new Set(policy.editableFields);
  const out: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(incoming || {})) {
    if (!allowed.has(key)) continue;
    if (val === undefined) continue;

    if (key === 'customCss') {
      out.customCss = sanitizeCustomCss(val, policy);
      continue;
    }
    if (key === 'fontUrl') {
      out.fontUrl = sanitizeFontUrl(val, policy);
      continue;
    }
    out[key] = val;
  }

  return out;
}

export function mergeBranding(
  existing: Record<string, unknown> = {},
  incoming: Record<string, unknown> = {},
  policy: BrandingPolicy,
): Record<string, unknown> {
  const filtered = filterEditableBranding(incoming, policy);
  const out = { ...(existing || {}) };

  for (const [key, val] of Object.entries(filtered)) {
    if (val === undefined) continue;
    out[key] = val;
  }

  return out;
}

export function stripCustomCssIfDisabled(
  branding: Record<string, unknown> | null | undefined,
  policy: BrandingPolicy,
): Record<string, unknown> | null | undefined {
  if (!branding) return branding;
  if (policy.customCssEnabled) return branding;
  const copy = { ...branding };
  delete copy.customCss;
  return copy;
}
