const FuncionarioService = require('../services/funcionariosService');
const CargoComissionadoService = require('../services/cargoComissionadoService');
const Logger = require('../utils/Logger');

class FuncionarioController {
  static async buscarFuncionarios(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;

    try {
      const funcionarios = await FuncionarioService.buscarFuncionarios(
        page,
        limit
      );

      res.json(funcionarios);
    } catch (err) {
      console.error('Erro ao buscar funcionários:', err);
      res.status(500).send('Erro ao buscar funcionários');
    }
  }
  static async buscarFuncionariosPorCoordenadoria(req, res) {
    const { coordId } = req.params;
    try {
      const funcionarios =
        await FuncionarioService.buscarFuncionariosPorCoordenadoria(coordId);

      res.json(funcionarios);
    } catch (err) {
      console.error('Erro ao buscar funcionários:', err);
      res.status(500).send('Erro ao buscar funcionários');
    }
  }

  static async buscarFuncionariosPorSetor(req, res) {
    try {
      const { idSetor } = req.params;
      const funcionarios =
        await FuncionarioService.buscarFuncionariosPorSetor(idSetor);
      return res.status(200).json(funcionarios);
    } catch (error) {
      console.error('Erro ao buscar funcionários por setor:', error);
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  static async buscarFuncionariosPorDivisoes(req, res) {
    const { ids, page, limit } = req.body;


    const idsArray = Array.isArray(ids)
      ? ids
      : typeof ids === 'string'
        ? ids.split(",").filter(id => id.length > 0)
        : [];

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 100;
    try {
      const funcionarios =
        await FuncionarioService.buscarFuncionariosPorDivisoes(idsArray, pageNumber, limitNumber);


      res.json(funcionarios);
    } catch (err) {
      console.error('Erro ao buscar funcionários:', err);
      res.status(500).send('Erro ao buscar funcionários');
    }
  }

  static async createFuncionario(req, res) {
    try {
      const funcionario = await FuncionarioService.createFuncionario(req);
      res.status(201).json(funcionario);
    } catch (error) {
      console.error(error);

      if (error.code === 11000) {
        return res.status(400).json({
          error: 'Já existe um funcionário com esse nome ou outro campo único.',
          campoDuplicado: Object.keys(error.keyValue)[0],
        });
      }

      res.status(500).json({ error: 'Erro ao criar funcionário' });
    }
  }

  static async updateFuncionario(req, res) {
    try {
      const response = await FuncionarioService.execute(
        req.params,
        req.body,
        req.files
      );
      res.status(response.status).json(response.data);
    } catch (error) {
      if (error.message === 'Funcionário não encontrado') {
        return res.status(404).json({ error: error.message });
      }
      Logger.error('Erro ao atualizar funcionário', error);
      res.status(500).json({ error: 'Erro ao atualizar funcionário' });
    }
  }

  static async deleteUsers(req, res) {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Lista de usuários inválida.' });
      }

      const result = await FuncionarioService.deleteUsers(userIds);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateCoordenadoria(req, res) {
    try {
      const result = await FuncionarioService.updateCoordinatoria(
        req.body.usuariosIds,
        req.body.coordenadoriaId
      );
      res.status(200).json(result);
    } catch (error) {
      Logger.error('Erro ao atualizar coordenadoria', error);
      res.status(500).json({ error: 'Erro ao atualizar coordenadoria' });
    }
  }

  static async updateObservacoes(req, res) {
    const { userId } = req.params;
    const { observacoes } = req.body;

    try {
      const user = await FuncionarioService.updateObservacoes(
        userId,
        observacoes
      );

      return res.status(200).json({
        message: 'Observações atualizadas com sucesso.',
        observacoes: user.observacoes,
      });
    } catch (error) {
      console.error('Erro ao atualizar observações:', error);
      return res
        .status(500)
        .json({ error: error.message || 'Erro ao atualizar observações.' });
    }
  }

  static async buscarCargos(req, res) {
    try {
      const cargos = await CargoComissionadoService.listarCargos();
      res.status(200).json(cargos);
    } catch {
      res.status(500).json({ error: 'Erro ao buscar cargos comissionados' });
    }
  }

  static async checkName(req, res) {
    try {
      const { name } = req.query;

      const result = await FuncionarioService.checkNameAvailability(name);

      res.status(result.statusCode).json({
        available: result.available,
        message: result.message,
      });
    } catch (error) {
      console.error('Erro ao verificar nome:', error);
      res.status(500).json({
        available: false,
        message: 'Erro ao verificar disponibilidade do nome',
      });
    }
  }

  static async checkHasFuncionarios(req, res) {
    try {
      const entityId = req.params.id;
      const hasEmployees = await FuncionarioService.hasFuncionarios(entityId);
      res.json({ hasEmployees });
    } catch (error) {
      console.error('Erro ao verificar funcionários:', error);

      if (error.message === 'Entidade não encontrada') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

module.exports = FuncionarioController;
