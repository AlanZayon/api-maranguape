const express = require('express');
const { funcionarioJoiSchema } = require('../validations/validateFuncionario');
const { validate } = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const FuncionarioController = require('../controllers/funcionariosController');
const RelatorioController = require('../controllers/relatorioController');
const upload = require('../config/multerConfig');

const router = express.Router();

router.use(authenticate);

router.get('/buscarFuncionarios', FuncionarioController.buscarFuncionarios);
router.get('/para-selecao', FuncionarioController.buscarParaSelecao);
router.get(
  '/buscarFuncionariosPorCoordenadoria/:coordId',
  FuncionarioController.buscarFuncionariosPorCoordenadoria
);
router.get(
  '/buscarFuncionariosPorSetorId/:setorId',
  (req, res, next) => {
    req.params.coordId = req.params.setorId;
    return FuncionarioController.buscarFuncionariosPorCoordenadoria(req, res, next);
  }
);
router.get(
  '/setores/:idSetor/funcionarios',
  FuncionarioController.buscarFuncionariosPorSetor
);

router.post(
  '/',
  authorize('admin', 'user'),
  upload,
  validate(funcionarioJoiSchema),
  FuncionarioController.createFuncionario
);
router.put(
  '/edit-funcionario/:id',
  authorize('admin', 'user'),
  upload,
  validate(funcionarioJoiSchema),
  FuncionarioController.updateFuncionario
);
router.delete('/delete-users', authorize('admin'), FuncionarioController.deleteUsers);
router.put(
  '/editar-coordenadoria-usuario',
  authorize('admin', 'user'),
  FuncionarioController.updateCoordenadoria
);
router.put(
  '/editar-lotacao-usuario',
  authorize('admin', 'user'),
  FuncionarioController.updateCoordenadoria
);
router.put(
  '/observacoes/:userId',
  authorize('admin', 'user'),
  FuncionarioController.updateObservacoes
);
router.post(
  '/relatorio-funcionarios/dados',
  RelatorioController.obterDados
);
router.get('/buscarCargos', FuncionarioController.buscarCargos);
router.get('/check-name', FuncionarioController.checkName);
router.post('/export/csv', authorize('admin', 'user'), FuncionarioController.exportCsv);
router.get('/:id/has-funcionarios', FuncionarioController.checkHasFuncionarios);
router.post('/por-divisoes', FuncionarioController.buscarFuncionariosPorDivisoes);
router.post('/por-setores', FuncionarioController.buscarFuncionariosPorDivisoes);

module.exports = router;
