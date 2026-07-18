const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const AuditController = require('../controllers/auditController');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize('admin', 'superadmin'),
  AuditController.list
);

module.exports = router;
