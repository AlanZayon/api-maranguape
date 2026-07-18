const DashboardService = require('../services/dashboardService');

class DashboardController {
  static async summary(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId || null;
      const summary = await DashboardService.getSummary(tenantId);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }

  static async contratos(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId || null;
      const withinDays = parseInt(req.query.within, 10) || 90;
      const limit = parseInt(req.query.limit, 10) || 20;
      const items = await DashboardService.getContratos(tenantId, {
        withinDays: Math.min(Math.max(withinDays, 1), 365),
        limit: Math.min(Math.max(limit, 1), 100),
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  }

  static async payroll(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId || null;
      const payroll = await DashboardService.getPayroll(tenantId);
      res.json(payroll);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DashboardController;
