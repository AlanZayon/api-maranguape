const express = require('express');
const { authenticate, authorize, TENANT_ELEVATED } = require('../middlewares/auth');
const DashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get(
  '/summary',
  authenticate,
  authorize(...TENANT_ELEVATED),
  DashboardController.summary
);
router.get(
  '/contratos',
  authenticate,
  authorize(...TENANT_ELEVATED),
  DashboardController.contratos
);
router.get(
  '/payroll',
  authenticate,
  authorize(...TENANT_ELEVATED),
  DashboardController.payroll
);

module.exports = router;
