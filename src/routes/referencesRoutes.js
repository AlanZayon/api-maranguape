const express = require('express');
const router = express.Router();
const ReferencesController = require('../controllers/referencesController');

router.post('/register-reference', ReferencesController.registerReference);
router.get('/referencias-dados', ReferencesController.getReferences);
router.delete('/delete-referencia/:id', ReferencesController.deleteReference);

module.exports = router;