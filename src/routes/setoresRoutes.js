const express = require('express');
const router = express.Router();
const { setorValidationSchema } = require('../validations/validatesSetor');
const { validate } = require('../middlewares/validate');
const {
  authenticate,
  authorize,
  TENANT_STAFF,
  TENANT_ELEVATED,
} = require('../middlewares/auth');
const SetorController = require('../controllers/SetorController');

router.use(authenticate);

router.post(
  '/',
  authorize(...TENANT_STAFF),
  validate(setorValidationSchema),
  SetorController.createSetor
);
router.get('/setoresOrganizados', SetorController.getSetoresOrganizados);
router.get('/setoresMain', SetorController.getMainSetores);
router.get('/dados/:setorId', SetorController.getSetorData);
router.put('/rename/:id', authorize(...TENANT_STAFF), SetorController.renameSetor);
router.put('/:id/parent', authorize(...TENANT_STAFF), SetorController.moveSetor);
router.delete('/del/:id', authorize(...TENANT_ELEVATED), SetorController.deleteSetor);

module.exports = router;
