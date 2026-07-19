const express = require('express');
const { authenticate, authorize, TENANT_ELEVATED } = require('../middlewares/auth');
const AuditController = require('../controllers/auditController');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize(...TENANT_ELEVATED),
  AuditController.list
);

module.exports = router;
