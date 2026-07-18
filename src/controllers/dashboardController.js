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
}

module.exports = DashboardController;
