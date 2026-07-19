const FuncionarioService = require('../services/funcionariosService');
const CargoComissionadoService = require('../services/cargoComissionadoService');
const {
  BULK_SYNC_THRESHOLD,
  enqueueDeleteUsers,
  enqueueExportCsv,
  getJobStatus,
} = require('../queues/bulkQueue');

function resolveTenantId(req) {
  return req.user?.tenantId || req.tenantId || null;
}

function listFiltersFromQuery(query = {}) {
  return {
    q: query.q || '',
    natureza: query.natureza || '',
    secretaria: query.secretaria || '',
    funcao: query.funcao || '',
    bairro: query.bairro || '',
    referencia: query.referencia || '',
  };
}

function listFiltersFromBody(body = {}) {
  return {
    q: body.q || '',
    natureza: body.natureza || '',
    secretaria: body.secretaria || '',
    funcao: body.funcao || '',
    bairro: body.bairro || '',
    referencia: body.referencia || '',
  };
}

class FuncionarioController {
  static async buscarFuncionarios(req, res, next) {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    try {
      const funcionarios = await FuncionarioService.buscarFuncionarios(
        page,
        limit,
        resolveTenantId(req),
        listFiltersFromQuery(req.query)
      );
      res.json(funcionarios);
    } catch (err) {
      next(err);
    }
  }

  static async getFiltrosDisponiveis(req, res, next) {
    try {
      const filtros = await FuncionarioService.getFiltrosDisponiveis(
        resolveTenantId(req)
      );
      res.json(filtros);
    } catch (err) {
      next(err);
    }
  }

  static async getMidia(req, res, next) {
    try {
      const midia = await FuncionarioService.getMidiaUrls(
        req.params.id,
        resolveTenantId(req)
      );
      res.json(midia);
    } catch (err) {
      next(err);
    }
  }

  static async buscarIds(req, res, next) {
    try {
      const body = req.body || {};
      const result = await FuncionarioService.buscarIds(
        {
          filters: listFiltersFromBody(body),
          setorIds: Array.isArray(body.ids) ? body.ids : body.setorIds || null,
          subtreeRoot: body.subtreeRoot || null,
          max: body.max || 10000,
        },
        resolveTenantId(req)
      );
      res.json(result);
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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    try {
      const funcionarios =
        await FuncionarioService.buscarFuncionariosPorCoordenadoria(
          coordId,
          page,
          limit,
          resolveTenantId(req),
          listFiltersFromQuery(req.query)
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
      const limit = parseInt(req.query.limit, 10) || 50;
      const funcionarios = await FuncionarioService.buscarFuncionariosPorSetor(
        idSetor,
        page,
        limit,
        resolveTenantId(req),
        listFiltersFromQuery(req.query)
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

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 50;
    try {
      const funcionarios =
        await FuncionarioService.buscarFuncionariosPorDivisoes(
          idsArray,
          pageNumber,
          limitNumber,
          resolveTenantId(req),
          listFiltersFromBody(req.body)
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

      const tenantId = resolveTenantId(req);

      if (userIds.length > BULK_SYNC_THRESHOLD) {
        const job = await enqueueDeleteUsers({ userIds, tenantId });
        return res.status(202).json({
          jobId: String(job.id),
          status: 'queued',
        });
      }

      const result = await FuncionarioService.deleteUsers(userIds, tenantId);
      res.status(200).json(result ?? { success: true, deleted: userIds.length });
    } catch (err) {
      next(err);
    }
  }

  static async getJob(req, res, next) {
    try {
      const status = await getJobStatus(req.params.jobId);
      if (!status) {
        return res.status(404).json({ error: 'Job não encontrado.' });
      }
      return res.status(200).json(status);
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
      const tenantId = resolveTenantId(req);

      if (ids.length > BULK_SYNC_THRESHOLD) {
        const job = await enqueueExportCsv({ ids, tenantId });
        return res.status(202).json({
          jobId: String(job.id),
          status: 'queued',
        });
      }

      const csv = await FuncionarioService.exportCsv(tenantId, ids);
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
