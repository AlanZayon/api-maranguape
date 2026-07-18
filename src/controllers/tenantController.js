const TenantService = require('../services/tenantService');
const AppError = require('../utils/AppError');

class TenantController {
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
}

module.exports = TenantController;
