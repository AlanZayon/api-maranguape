const express = require('express');
const router = express.Router();
const { setorValidationSchema } = require('../validations/validatesSetor');
const { validate } = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const SetorController = require('../controllers/SetorController');

router.use(authenticate);

router.post(
  '/',
  authorize('admin', 'user'),
  validate(setorValidationSchema),
  SetorController.createSetor
);
router.get('/setoresOrganizados', SetorController.getSetoresOrganizados);
router.get('/setoresMain', SetorController.getMainSetores);
router.get('/dados/:setorId', SetorController.getSetorData);
router.put('/rename/:id', authorize('admin', 'user'), SetorController.renameSetor);
router.put('/:id/parent', authorize('admin', 'user'), SetorController.moveSetor);
router.delete('/del/:id', authorize('admin'), SetorController.deleteSetor);

module.exports = router;
