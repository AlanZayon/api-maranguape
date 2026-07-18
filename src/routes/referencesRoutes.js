const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const ReferencesController = require('../controllers/referencesController');

router.use(authenticate);

router.post(
  '/register-reference',
  authorize('admin'),
  ReferencesController.registerReference
);
router.get('/referencias-dados', ReferencesController.getReferences);
router.delete(
  '/delete-referencia/:id',
  authorize('admin'),
  ReferencesController.deleteReference
);

module.exports = router;
