const FuncionarioService = require('../services/funcionariosService');
const CargoComissionadoService = require('../services/cargoComissionadoService');

function resolveTenantId(req) {
  return req.user?.tenantId || req.tenantId || null;
}

class FuncionarioController {
  static async buscarFuncionarios(req, res, next) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;

    try {
      const funcionarios = await FuncionarioService.buscarFuncionarios(
        page,
        limit,
        resolveTenantId(req)
      );
      res.json(funcionarios);
    } catch (err) {
      next(err);
    }
  }

  static async buscarParaSelecao(req, res, next) {
    try {
      const incluirFiltros =
        req.query.incluirFiltros === '1' ||
        req.query.incluirFiltros === 'true' ||
        req.query.page === undefined ||
        String(req.query.page) === '1';

      const result = await FuncionarioService.buscarParaSelecao(
        {
          q: req.query.q || '',
          natureza: req.query.natureza || '',
          secretaria: req.query.secretaria || '',
          funcao: req.query.funcao || '',
          page: req.query.page || 1,
          limit: req.query.limit || 15,
          incluirFiltros,
        },
        resolveTenantId(req)
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async buscarFuncionariosPorCoordenadoria(req, res, next) {
    const { coordId } = req.params;
    try {
      const funcionarios =
        await FuncionarioService.buscarFuncionariosPorCoordenadoria(
          coordId,
          resolveTenantId(req)
        );
      res.json(funcionarios);
    } catch (err) {
      next(err);
    }
  }

  static async buscarFuncionariosPorSetor(req, res, next) {
    try {
      const { idSetor } = req.params;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 1000;
      const funcionarios = await FuncionarioService.buscarFuncionariosPorSetor(
        idSetor,
        page,
        Math.min(limit, 5000),
        resolveTenantId(req)
      );
      return res.status(200).json(funcionarios);
    } catch (err) {
      next(err);
    }
  }

  static async buscarFuncionariosPorDivisoes(req, res, next) {
    const { ids, page, limit } = req.body;

    const idsArray = Array.isArray(ids)
      ? ids
      : typeof ids === 'string'
        ? ids.split(',').filter((id) => id.length > 0)
        : [];

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 100;
    try {
      const funcionarios =
        await FuncionarioService.buscarFuncionariosPorDivisoes(
          idsArray,
          pageNumber,
          limitNumber,
          resolveTenantId(req)
        );
      res.json(funcionarios);
    } catch (err) {
      next(err);
    }
  }

  static async createFuncionario(req, res, next) {
    try {
      const funcionario = await FuncionarioService.createFuncionario(req);
      res.status(201).json(funcionario);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          error: 'Já existe um funcionário com esse nome ou outro campo único.',
          campoDuplicado: Object.keys(error.keyValue)[0],
        });
      }
      next(error);
    }
  }

  static async updateFuncionario(req, res, next) {
    try {
      const response = await FuncionarioService.execute(
        req.params,
        req.body,
        req.files,
        resolveTenantId(req)
      );
      res.status(response.status).json(response.data);
    } catch (error) {
      if (error.message === 'Funcionário não encontrado') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  static async deleteUsers(req, res, next) {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Lista de usuários inválida.' });
      }

      const result = await FuncionarioService.deleteUsers(
        userIds,
        resolveTenantId(req)
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateCoordenadoria(req, res, next) {
    try {
      const destino =
        req.body.setorId || req.body.coordenadoriaId || req.body.lotacaoId;
      const result = await FuncionarioService.updateLotacao(
        req.body.usuariosIds,
        destino,
        resolveTenantId(req)
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateObservacoes(req, res, next) {
    const { userId } = req.params;
    const { observacoes } = req.body;

    try {
      const user = await FuncionarioService.updateObservacoes(
        userId,
        observacoes,
        resolveTenantId(req)
      );

      return res.status(200).json({
        message: 'Observações atualizadas com sucesso.',
        observacoes: user.observacoes,
      });
    } catch (err) {
      next(err);
    }
  }

  static async buscarCargos(req, res, next) {
    try {
      const cargos = await CargoComissionadoService.listarCargos();
      res.status(200).json(cargos);
    } catch (err) {
      next(err);
    }
  }

  static async checkName(req, res, next) {
    try {
      const { name } = req.query;
      const result = await FuncionarioService.checkNameAvailability(
        name,
        resolveTenantId(req)
      );

      res.status(result.statusCode).json({
        available: result.available,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  static async checkHasFuncionarios(req, res, next) {
    try {
      const entityId = req.params.id;
      const hasEmployees = await FuncionarioService.hasFuncionarios(entityId);
      res.json({ hasEmployees });
    } catch (error) {
      if (error.message === 'Entidade não encontrada') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  static async exportCsv(req, res, next) {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const csv = await FuncionarioService.exportCsv(
        resolveTenantId(req),
        ids
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="funcionarios.csv"'
      );
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = FuncionarioController;
