const express = require('express');
const { funcionarioJoiSchema } = require('../validations/validateFuncionario');
const { validate } = require('../middlewares/validate');
const FuncionarioController = require('../controllers/funcionariosController');
const RelatorioController = require('../controllers/relatorioController');
const upload = require('../config/multerConfig');

const router = express.Router();

router.get('/buscarFuncionarios', FuncionarioController.buscarFuncionarios);
router.get(
  '/buscarFuncionariosPorCoordenadoria/:coordId',
  FuncionarioController.buscarFuncionariosPorCoordenadoria
);
router.get(
  '/setores/:idSetor/funcionarios',
  FuncionarioController.buscarFuncionariosPorSetor
);

router.post(
  '/',
  upload,
  validate(funcionarioJoiSchema),
  FuncionarioController.createFuncionario
);
router.put(
  '/edit-funcionario/:id',
  upload,
  validate(funcionarioJoiSchema),
  FuncionarioController.updateFuncionario
);
router.delete('/delete-users', FuncionarioController.deleteUsers);
router.put(
  '/editar-coordenadoria-usuario',
  FuncionarioController.updateCoordenadoria
);
router.put('/observacoes/:userId', FuncionarioController.updateObservacoes);
router.post(
  '/relatorio-funcionarios/gerar',
  RelatorioController.gerarRelatorio
);
router.get('/buscarCargos', FuncionarioController.buscarCargos);

router.get('/check-name', FuncionarioController.checkName);

router.get('/:id/has-funcionarios', FuncionarioController.checkHasFuncionarios);

module.exports = router;
