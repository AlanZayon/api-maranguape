const express = require('express');
const { authenticate, authorize, TENANT_ELEVATED } = require('../middlewares/auth');
const TenantController = require('../controllers/tenantController');
const { uploadSingle } = require('../config/multerConfig');

const router = express.Router();

router.get('/branding-policy', TenantController.brandingPolicy);

router.get('/by-slug/:slug', TenantController.bySlug);

router.get('/me', authenticate, TenantController.me);

router.patch(
  '/me',
  authenticate,
  authorize(...TENANT_ELEVATED),
  TenantController.updateMe
);

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

router.get(
  '/:id',
  authenticate,
  authorize('superadmin'),
  TenantController.getById
);

router.patch(
  '/:id',
  authenticate,
  authorize('superadmin'),
  TenantController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize('superadmin'),
  TenantController.deactivate
);

router.post(
  '/:id/assets',
  authenticate,
  authorize(...TENANT_ELEVATED),
  uploadSingle,
  TenantController.uploadAsset
);

module.exports = router;
