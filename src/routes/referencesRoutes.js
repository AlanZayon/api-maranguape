const express = require('express');
const router = express.Router();
const { authenticate, authorize, TENANT_ELEVATED } = require('../middlewares/auth');
const ReferencesController = require('../controllers/referencesController');

router.use(authenticate);

router.post(
  '/register-reference',
  authorize(...TENANT_ELEVATED),
  ReferencesController.registerReference
);
router.get('/referencias-dados', ReferencesController.getReferences);
router.delete(
  '/delete-referencia/:id',
  authorize(...TENANT_ELEVATED),
  ReferencesController.deleteReference
);

module.exports = router;
