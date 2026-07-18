const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { cargoComissionadoJoiSchema } = require('../validations/validateCargoComissionado');
const CargoComissionadoController = require('../controllers/cargoComissionadoController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (
      name.endsWith('.xlsx') ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/octet-stream'
    ) {
      return cb(null, true);
    }
    return cb(new Error('Apenas arquivos .xlsx são permitidos.'));
  },
});

router.use(authenticate);

router.get('/', CargoComissionadoController.listar);
router.get(
  '/template',
  authorize('admin', 'superadmin'),
  CargoComissionadoController.template
);
router.post(
  '/import',
  authorize('admin', 'superadmin'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Falha no upload.' });
      }
      return next();
    });
  },
  CargoComissionadoController.importar
);
router.post(
  '/',
  authorize('admin', 'superadmin'),
  validate(cargoComissionadoJoiSchema),
  CargoComissionadoController.criar
);
router.put(
  '/:id',
  authorize('admin', 'superadmin'),
  validate(cargoComissionadoJoiSchema),
  CargoComissionadoController.atualizar
);
router.delete(
  '/:id',
  authorize('admin', 'superadmin'),
  CargoComissionadoController.remover
);

module.exports = router;
