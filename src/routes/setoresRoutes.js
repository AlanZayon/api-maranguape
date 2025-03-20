const express = require('express');
const router = express.Router();
const { setorValidationSchema } = require('../validations/validatesSetor');
const { validate } = require('../middlewares/validate');
const SetorController = require('../controllers/SetorController');

router.post('/', validate(setorValidationSchema), SetorController.createSetor);
router.get('/setoresOrganizados', SetorController.getSetoresOrganizados);
router.get('/setoresMain', SetorController.getMainSetores);
router.get('/dados/:setorId', SetorController.getSetorData);
router.put('/rename/:id', SetorController.renameSetor);
router.delete('/del/:id', SetorController.deleteSetor);

module.exports = router;
