const Tenant = require('../models/tenantSchema');
const User = require('../models/usuariosSchema');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const AppError = require('../utils/AppError');

class TenantService {
  static brandingPayload(tenant) {
    return {
      slug: tenant.slug,
      name: tenant.name,
      branding: tenant.branding,
      settings: tenant.settings,
      status: tenant.status,
      _id: tenant._id,
    };
  }

  static async getById(id) {
    const tenant = await Tenant.findById(id).lean();
    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }
    return this.brandingPayload(tenant);
  }

  static async getBySlug(slug) {
    const tenant = await Tenant.findOne({
      slug: String(slug).toLowerCase().trim(),
      status: 'active',
    }).lean();

    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }

    return {
      slug: tenant.slug,
      name: tenant.name,
      branding: tenant.branding,
    };
  }

  static async list() {
    return Tenant.find().sort({ name: 1 }).lean();
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

    let tenant;
    try {
      tenant = await Tenant.create({
        slug: String(slug).toLowerCase().trim(),
        name,
        branding: {
          logoUrl: branding.logoUrl || null,
          primaryColor: branding.primaryColor || '#1a5f2a',
          displayName: branding.displayName || name,
        },
        settings: {
          vocabulary: settings.vocabulary || {},
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
        role: admin.role || 'admin',
        tenantId: tenant._id,
      });
      const obj = firstAdmin.toObject();
      delete obj.passwordHash;
      delete obj.lastValidToken;
      firstAdmin = obj;
    }

    return {
      tenant: this.brandingPayload(tenant.toObject()),
      admin: firstAdmin,
    };
  }
}

module.exports = TenantService;
