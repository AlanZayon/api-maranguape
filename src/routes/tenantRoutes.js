const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const TenantController = require('../controllers/tenantController');

const router = express.Router();

router.get('/by-slug/:slug', TenantController.bySlug);

router.get('/me', authenticate, TenantController.me);

router.get(
  '/',
  authenticate,
  authorize('superadmin'),
  TenantController.list
);

router.post(
  '/',
  authenticate,
  authorize('superadmin'),
  TenantController.create
);

module.exports = router;
