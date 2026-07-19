const TenantService = require('../services/tenantService');
const AppError = require('../utils/AppError');
const { getBrandingPolicyPublic } = require('../config/brandingPolicy');

class TenantController {
  static async brandingPolicy(req, res, next) {
    try {
      res.json(getBrandingPolicyPublic());
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        throw new AppError(
          'Nenhum tenant associado ao usuário',
          400,
          'NO_TENANT'
        );
      }
      const tenant = await TenantService.getById(tenantId);
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  }

  static async updateMe(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        throw new AppError(
          'Nenhum tenant associado ao usuário',
          400,
          'NO_TENANT'
        );
      }
      if (req.user?.role === 'superadmin' && !req.user?.tenantId && !req.actingAsTenant) {
        throw new AppError(
          'Use PATCH /api/tenants/:id como superadmin',
          400,
          'USE_TENANT_ID'
        );
      }
      const tenant = await TenantService.updateMe(tenantId, req.body);
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  }

  static async bySlug(req, res, next) {
    try {
      const branding = await TenantService.getBySlug(req.params.slug);
      res.json(branding);
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await TenantService.create(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async list(req, res, next) {
    try {
      const tenants = await TenantService.list();
      res.json({ tenants });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const tenant = await TenantService.getById(req.params.id);
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const tenant = await TenantService.update(req.params.id, req.body);
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  }

  static async deactivate(req, res, next) {
    try {
      const tenant = await TenantService.deactivate(req.params.id);
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  }

  static async uploadAsset(req, res, next) {
    try {
      const kind = req.body?.kind || req.query?.kind || 'logo';
      const tenantId = req.params.id;
      const requesterTenant = req.user?.tenantId
        ? String(req.user.tenantId)
        : null;

      if (
        req.user?.role !== 'superadmin' &&
        requesterTenant !== String(tenantId)
      ) {
        throw new AppError('Acesso negado', 403, 'FORBIDDEN');
      }

      const file = req.file;
      const result = await TenantService.uploadAsset(tenantId, file, kind);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TenantController;
