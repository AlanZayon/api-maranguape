/**
 * Tenant branding policy driven by environment variables.
 * API is the source of truth; frontend reads via GET /api/tenants/branding-policy.
 */

const ALL_BRANDING_FIELDS = [
  'logoUrl',
  'faviconUrl',
  'displayName',
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
  'fontFamily',
  'fontUrl',
  'themeMode',
  'customCss',
];

const COLOR_FIELDS = new Set([
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

const DEFAULT_ALLOWED_SELECTORS = [
  '.login-page',
  '.login-card',
  '.sidebar',
  '.app-header',
  '.app-shell',
  '.btn-brand',
  '.dashboard-page',
  '.dashboard-stat',
];

const DEFAULT_FONT_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

function parseBool(value, fallback = true) {
  if (value == null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function parseCsv(value, fallback = []) {
  if (value == null || String(value).trim() === '') return [...fallback];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntEnv(value, fallback) {
  if (value == null || value === '') return fallback;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getBrandingPolicy() {
  const customCssEnabled = parseBool(
    process.env.TENANT_CUSTOM_CSS_ENABLED,
    true
  );
  const customCssMaxLength = parseIntEnv(
    process.env.TENANT_CUSTOM_CSS_MAX_LENGTH,
    20_000
  );
  const allowedSelectors = parseCsv(
    process.env.TENANT_CUSTOM_CSS_ALLOWED_SELECTORS,
    DEFAULT_ALLOWED_SELECTORS
  );
  const fontUrlHosts = parseCsv(
    process.env.TENANT_FONT_URL_HOSTS,
    DEFAULT_FONT_HOSTS
  );
  const assetMaxBytes = parseIntEnv(
    process.env.TENANT_BRANDING_ASSET_MAX_BYTES,
    2 * 1024 * 1024
  );

  let editableFields = parseCsv(
    process.env.TENANT_BRANDING_EDITABLE_FIELDS,
    ALL_BRANDING_FIELDS
  );
  editableFields = editableFields.filter((f) => ALL_BRANDING_FIELDS.includes(f));
  if (!editableFields.length) {
    editableFields = [...ALL_BRANDING_FIELDS];
  }
  if (!customCssEnabled) {
    editableFields = editableFields.filter((f) => f !== 'customCss');
  }

  return {
    customCssEnabled,
    customCssMaxLength,
    allowedSelectors,
    editableFields,
    fontUrlHosts,
    assetMaxBytes,
    allBrandingFields: ALL_BRANDING_FIELDS,
    colorFields: [...COLOR_FIELDS],
  };
}

/** Public JSON for the frontend wizard. */
function getBrandingPolicyPublic() {
  const p = getBrandingPolicy();
  return {
    customCssEnabled: p.customCssEnabled,
    customCssMaxLength: p.customCssMaxLength,
    allowedSelectors: p.allowedSelectors,
    editableFields: p.editableFields,
    fontUrlHosts: p.fontUrlHosts,
    assetMaxBytes: p.assetMaxBytes,
    colorFields: p.colorFields,
  };
}

module.exports = {
  ALL_BRANDING_FIELDS,
  COLOR_FIELDS,
  DEFAULT_ALLOWED_SELECTORS,
  DEFAULT_FONT_HOSTS,
  getBrandingPolicy,
  getBrandingPolicyPublic,
};
