const AuditService = require('../services/auditService');

class AuditController {
  static async list(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const skip = parseInt(req.query.skip, 10) || 0;
      const isSuperadmin = req.user?.role === 'superadmin';
      const tenantId = req.user?.tenantId || req.tenantId || null;

      const result = await AuditService.list({
        tenantId,
        limit,
        skip,
        isSuperadmin,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuditController;
