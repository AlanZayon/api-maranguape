const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const DashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', authenticate, DashboardController.summary);
router.get('/contratos', authenticate, DashboardController.contratos);
router.get(
  '/payroll',
  authenticate,
  authorize('admin', 'superadmin'),
  DashboardController.payroll
);

module.exports = router;
