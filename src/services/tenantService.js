const Tenant = require('../models/tenantSchema');
const User = require('../models/usuariosSchema');
const Setor = require('../models/setoresSchema');
const Simbologia = require('../models/limitesSimbologiaSchema');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const AppError = require('../utils/AppError');
const {
  sanitizeColor,
  sanitizeFontUrl,
  sanitizeCustomCss,
  mergeBranding,
  filterEditableBranding,
  stripCustomCssIfDisabled,
  isReservedSubdomain,
} = require('../utils/tenantHelpers');
const { getBrandingPolicy } = require('../config/brandingPolicy');
const awsUtils = require('../utils/awsUtils');

const DEFAULT_VOCABULARY = {
  funcionario: 'Funcionário',
  setor: 'Setor',
  subsetor: 'Subsetor',
  cargo: 'Cargo',
  referencia: 'Referência',
};

class TenantService {
  static async resolveMediaUrl(value) {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    try {
      return await awsUtils.gerarUrlPreAssinada(value);
    } catch {
      return value;
    }
  }

  static async brandingPayload(tenant) {
    let branding = { ...(tenant.branding || {}) };
    branding.logoUrl = await this.resolveMediaUrl(branding.logoUrl);
    branding.faviconUrl = await this.resolveMediaUrl(branding.faviconUrl);
    branding = stripCustomCssIfDisabled(branding);

    return {
      slug: tenant.slug,
      name: tenant.name,
      branding,
      settings: tenant.settings,
      status: tenant.status,
      _id: tenant._id,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  static normalizeBranding(branding = {}, name, { filterEditable = true } = {}) {
    const source = filterEditable
      ? { ...filterEditableBranding(branding) }
      : { ...(branding || {}) };
    const policy = getBrandingPolicy();

    // When not filtering (post-merge sanitize), keep existing values; still strip CSS if disabled
    const pick = (key, fallback = null) => {
      if (source[key] !== undefined) return source[key];
      if (!filterEditable && branding[key] !== undefined) return branding[key];
      return fallback;
    };

    return {
      logoUrl: pick('logoUrl', null) || null,
      faviconUrl: pick('faviconUrl', null) || null,
      primaryColor: sanitizeColor(pick('primaryColor'), '#1a5f2a'),
      secondaryColor: (() => {
        const raw = pick('secondaryColor', null);
        if (raw == null || raw === '') return null;
        return sanitizeColor(raw, null);
      })(),
      primaryContrast: sanitizeColor(pick('primaryContrast'), '#ffffff'),
      headerBg: sanitizeColor(pick('headerBg'), '#1b1f24'),
      headerText: sanitizeColor(pick('headerText'), '#f8f9fa'),
      sidebarBg: sanitizeColor(pick('sidebarBg'), '#ffffff'),
      sidebarText: sanitizeColor(pick('sidebarText'), '#343a40'),
      surfaceBg: sanitizeColor(pick('surfaceBg'), '#ffffff'),
      pageBg: sanitizeColor(pick('pageBg'), '#f3f4f6'),
      textColor: sanitizeColor(pick('textColor'), '#212529'),
      mutedColor: sanitizeColor(pick('mutedColor'), '#6c757d'),
      borderColor: sanitizeColor(pick('borderColor'), '#dee2e6'),
      fontFamily: pick('fontFamily', null) || null,
      fontUrl: sanitizeFontUrl(pick('fontUrl', null)),
      themeMode: pick('themeMode') === 'dark' ? 'dark' : 'light',
      customCss: (() => {
        if (!policy.customCssEnabled) {
          // Create: no CSS. Update: keep stored value (ignore client writes).
          return filterEditable ? null : branding.customCss ?? null;
        }
        return sanitizeCustomCss(pick('customCss', null));
      })(),
      displayName: pick('displayName', null) || name,
    };
  }

  static async getById(id) {
    const tenant = await Tenant.findById(id).lean();
    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }
    return await this.brandingPayload(tenant);
  }

  static async getBySlug(slug) {
    const tenant = await Tenant.findOne({
      slug: String(slug).toLowerCase().trim(),
      status: 'active',
    }).lean();

    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }

    const payload = await this.brandingPayload(tenant);
    return {
      slug: payload.slug,
      name: payload.name,
      branding: payload.branding,
      settings: {
        vocabulary: tenant.settings?.vocabulary || {},
      },
    };
  }

  static async list() {
    const tenants = await Tenant.find().sort({ name: 1 }).lean();
    return Promise.all(tenants.map((t) => this.brandingPayload(t)));
  }

  static async seedDefaults(tenantId, userId = null) {
    const existingRoot = await Setor.findOne({
      tenantId,
      parent: null,
    });
    if (!existingRoot) {
      await Setor.create({
        nome: 'ADMINISTRAÇÃO',
        tipo: 'Setor',
        parent: null,
        tenantId,
        createdBy: userId,
      });
    }

    const defaultSimb = await Simbologia.findOne({
      tenantId,
      simbologia: 'DAS-1',
    });
    if (!defaultSimb) {
      await Simbologia.create({
        simbologia: 'DAS-1',
        limite: 10,
        tenantId,
        createdBy: userId,
      });
    }
  }

  static async create(data) {
    const {
      slug,
      name,
      branding = {},
      settings = {},
      status = 'active',
      admin,
    } = data;

    if (!slug || !name) {
      throw new AppError(
        'slug e name são obrigatórios',
        400,
        'VALIDATION_ERROR'
      );
    }

    const normalizedSlug = String(slug).toLowerCase().trim();
    if (isReservedSubdomain(normalizedSlug)) {
      throw new AppError(
        'Slug reservado pela plataforma',
        400,
        'RESERVED_SLUG'
      );
    }

    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(normalizedSlug)) {
      throw new AppError(
        'Slug inválido (use letras minúsculas, números e hífens)',
        400,
        'INVALID_SLUG'
      );
    }

    const seedOnCreate =
      settings.seedOnCreate === undefined ? true : Boolean(settings.seedOnCreate);

    let tenant;
    try {
      tenant = await Tenant.create({
        slug: normalizedSlug,
        name,
        branding: this.normalizeBranding(branding, name),
        settings: {
          vocabulary: {
            ...DEFAULT_VOCABULARY,
            ...(settings.vocabulary || {}),
          },
          seedOnCreate,
        },
        status,
      });
    } catch (err) {
      if (err.code === 11000) {
        throw new AppError('Slug de tenant já existe', 409, 'CONFLICT');
      }
      throw err;
    }

    let firstAdmin = null;
    if (admin?.username && admin?.password) {
      const passwordHash = await bcrypt.hash(admin.password, 10);
      firstAdmin = await User.create({
        id: admin.id || randomUUID(),
        username: admin.username,
        passwordHash,
        role: 'owner',
        tenantId: tenant._id,
      });
      const obj = firstAdmin.toObject();
      delete obj.passwordHash;
      delete obj.lastValidToken;
      firstAdmin = obj;
    }

    if (seedOnCreate) {
      await this.seedDefaults(tenant._id, firstAdmin?._id || null);
    }

    return {
      tenant: await this.brandingPayload(tenant.toObject()),
      admin: firstAdmin,
    };
  }

  static async update(id, data) {
    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }

    if (data.name !== undefined) tenant.name = data.name;
    if (data.status !== undefined) {
      if (!['active', 'inactive'].includes(data.status)) {
        throw new AppError('Status inválido', 400, 'VALIDATION_ERROR');
      }
      tenant.status = data.status;
    }
    if (data.branding) {
      const existing =
        tenant.branding?.toObject?.() || tenant.branding || {};
      const merged = mergeBranding(existing, data.branding);
      tenant.branding = this.normalizeBranding(merged, data.name || tenant.name, {
        filterEditable: false,
      });
    }
    if (data.settings) {
      tenant.settings = {
        vocabulary: {
          ...(tenant.settings?.vocabulary || {}),
          ...(data.settings.vocabulary || {}),
        },
        seedOnCreate:
          data.settings.seedOnCreate !== undefined
            ? Boolean(data.settings.seedOnCreate)
            : tenant.settings?.seedOnCreate,
      };
    }

    await tenant.save();
    return await this.brandingPayload(tenant.toObject());
  }

  static async updateMe(tenantId, data) {
    const allowed = {
      branding: data.branding,
      settings: data.settings
        ? { vocabulary: data.settings.vocabulary }
        : undefined,
    };
    return this.update(tenantId, allowed);
  }

  static async deactivate(id) {
    return this.update(id, { status: 'inactive' });
  }

  static async uploadAsset(tenantId, file, kind = 'logo') {
    if (!file) {
      throw new AppError('Arquivo obrigatório', 400, 'VALIDATION_ERROR');
    }
    if (!['logo', 'favicon'].includes(kind)) {
      throw new AppError('kind deve ser logo ou favicon', 400, 'VALIDATION_ERROR');
    }

    const policy = getBrandingPolicy();
    if (file.size > policy.assetMaxBytes) {
      throw new AppError(
        `Arquivo excede o limite de ${policy.assetMaxBytes} bytes`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    const mime = String(file.mimetype || '');
    if (!mime.startsWith('image/')) {
      throw new AppError(
        'Arquivo deve ser uma imagem',
        400,
        'INVALID_FILE_TYPE'
      );
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }

    const key = await awsUtils.uploadFile(file, `branding/${kind}`, tenantId);
    const url = await awsUtils.gerarUrlPreAssinada(key);

    if (kind === 'logo') {
      tenant.branding.logoUrl = key;
    } else {
      tenant.branding.faviconUrl = key;
    }
    await tenant.save();

    return {
      kind,
      key,
      url,
      tenant: await this.brandingPayload(tenant.toObject()),
    };
  }
}

module.exports = TenantService;
