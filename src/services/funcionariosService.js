const mongoose = require('mongoose');
const FuncionarioRepository = require('../repositories/FuncionariosRepository');
const SetorRepository = require('../repositories/SetorRepository');
const CargoComissionado = require('../repositories/cargoComissionadoRepository');
const CacheService = require('../services/CacheService');
const awsUtils = require('../utils/awsUtils');
const LimiteService = require('../utils/LimiteService');
const normalizarTexto = require('../utils/normalizarTexto');
const normalizeObservacoes = require('../utils/normalizeObservacoes');
const AppError = require('../utils/AppError');

const BATCH_SIZE = 100;

/** Resolve lotação id from body (setorId canônico ou alias coordenadoria). */
function resolveSetorId(body = {}) {
  return body.setorId || body.coordenadoria || null;
}

function lotacaoIdOf(funcionario) {
  if (!funcionario) return null;
  return funcionario.setorId || funcionario.coordenadoria || null;
}

function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

class FuncionarioService {
  static async buscarFuncionarios(page = 1, limit = 100, tenantId = null) {
    const cacheKey = tenantId
      ? `tenant:${tenantId}:todos:funcionarios:page${page}`
      : `todos:funcionarios:page${page}`;

    return await CacheService.getOrSetCache(cacheKey, async () => {
      const skip = (page - 1) * limit;

      const total = await FuncionarioRepository.countDocuments(tenantId);

      const funcionarios = await FuncionarioRepository.findAll(tenantId)
        .skip(skip)
        .limit(limit);

      const funcionariosComUrls = await Promise.all(
        funcionarios.map(async (funcionario) => ({
          ...funcionario,
          fotoUrl: funcionario.foto
            ? await awsUtils.gerarUrlPreAssinada(funcionario.foto)
            : null,
          arquivoUrl: funcionario.arquivo
            ? await awsUtils.gerarUrlPreAssinada(funcionario.arquivo)
            : null,
        }))
      );

      return {
        funcionarios: funcionariosComUrls,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    });
  }

  /**
   * Listagem paginada para pickers (referências, etc.) com busca e filtros.
   * Sem cache Redis — resultado depende de q/filtros.
   */
  static async buscarParaSelecao(
    {
      q = '',
      natureza = '',
      secretaria = '',
      funcao = '',
      page = 1,
      limit = 15,
      incluirFiltros = false,
    } = {},
    tenantId = null
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;
    const filters = { q, natureza, secretaria, funcao };

    const [total, funcionarios, filtros] = await Promise.all([
      FuncionarioRepository.countParaSelecao(filters, tenantId),
      FuncionarioRepository.findParaSelecao(filters, skip, limitNum, tenantId),
      incluirFiltros
        ? FuncionarioRepository.distinctFiltrosSelecao(tenantId)
        : Promise.resolve(null),
    ]);

    const result = {
      funcionarios,
      total,
      page: pageNum,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    };

    if (filtros) {
      result.filtros = filtros;
    }

    return result;
  }

  static async buscarFuncionariosPorCoordenadoria(idCoordenadoria, tenantId = null) {
    return this.buscarFuncionariosPorLotacao(idCoordenadoria, tenantId);
  }

  static async buscarFuncionariosPorLotacao(setorId, tenantId = null) {
    return await CacheService.getOrSetCache(
      `setor:${setorId}:funcionarios`,
      async () => {
        const objectId = mongoose.Types.ObjectId.isValid(setorId)
          ? new mongoose.Types.ObjectId(setorId)
          : setorId;

        const funcionarios = await FuncionarioRepository.findBySetorId(
          [objectId],
          tenantId
        );

        return await Promise.all(
          funcionarios.map(async (funcionario) => ({
            ...funcionario,
            fotoUrl: funcionario.foto
              ? await awsUtils.gerarUrlPreAssinada(funcionario.foto)
              : null,
            arquivoUrl: funcionario.arquivo
              ? await awsUtils.gerarUrlPreAssinada(funcionario.arquivo)
              : null,
          }))
        );
      }
    );
  }

  static async buscarFuncionariosPorSetor(
    idSetor,
    page = 1,
    limit = 100,
    tenantId = null
  ) {
    const objectId = mongoose.Types.ObjectId.isValid(idSetor)
      ? new mongoose.Types.ObjectId(idSetor)
      : idSetor;

    return await CacheService.getOrSetCache(
      `setor:${idSetor}:funcionarios:page:${page}`,
      async () => {
        const skip = (page - 1) * limit;

        const total = await FuncionarioRepository.countBySetor(
          objectId,
          tenantId
        );

        const funcionarios =
          await FuncionarioRepository.buscarFuncionariosPorSetor(
            objectId,
            skip,
            limit,
            tenantId
          );

        const funcionariosComUrls = await Promise.all(
          funcionarios.map(async (funcionario) => ({
            ...funcionario,
            fotoUrl: funcionario.foto
              ? await awsUtils.gerarUrlPreAssinada(funcionario.foto)
              : null,
            arquivoUrl: funcionario.arquivo
              ? await awsUtils.gerarUrlPreAssinada(funcionario.arquivo)
              : null,
          }))
        );

        return {
          funcionarios: funcionariosComUrls,
          total,
          page,
          pages: Math.ceil(total / limit),
        };
      }
    );
  }

  static async buscarFuncionariosPorDivisoes(
    idsDivisoes,
    page = 1,
    limit = 100,
    tenantId = null
  ) {
    return this.buscarFuncionariosPorSetores(idsDivisoes, page, limit, tenantId);
  }

  static async buscarFuncionariosPorSetores(
    idsSetores,
    page = 1,
    limit = 100,
    tenantId = null
  ) {
    return CacheService.getOrSetCache(
      `setores:${idsSetores.join('-')}:page${page}`,
      async () => {
        const skip = (page - 1) * limit;

        const [total, funcionarios] = await Promise.all([
          FuncionarioRepository.countBySetor(idsSetores, tenantId),
          FuncionarioRepository.findBySetores(
            idsSetores,
            skip,
            limit,
            tenantId
          ),
        ]);

        const funcionariosComUrls = await Promise.all(
          funcionarios.map(async (f) => ({
            ...f,
            fotoUrl: f.foto
              ? await awsUtils.gerarUrlPreAssinada(f.foto)
              : null,
            arquivoUrl: f.arquivo
              ? await awsUtils.gerarUrlPreAssinada(f.arquivo)
              : null,
          }))
        );

        return {
          funcionarios: funcionariosComUrls,
          total,
          page,
          pages: Math.ceil(total / limit),
        };
      }
    );
  }

  static async exportCsv(tenantId = null, ids = null) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError(
        'Selecione ao menos um funcionário para exportar.',
        400,
        'BAD_REQUEST'
      );
    }

    const rows = await FuncionarioRepository.findForExport(tenantId, ids);
    const header = [
      'nome',
      'secretaria',
      'funcao',
      'natureza',
      'referencia',
      'salarioBruto',
    ];
    const lines = [header.join(',')];

    for (const row of rows) {
      lines.push(
        [
          escapeCsv(row.nome),
          escapeCsv(row.secretaria),
          escapeCsv(row.funcao),
          escapeCsv(row.natureza),
          escapeCsv(row.referencia),
          escapeCsv(row.salarioBruto),
        ].join(',')
      );
    }

    return `\uFEFF${lines.join('\n')}`;
  }

  static async createFuncionario(req) {
    const tenantId = req.user?.tenantId || req.tenantId || null;
    const fotoUrlAWS = req.files?.foto
      ? await awsUtils.uploadFile(req.files.foto[0], 'fotos', tenantId)
      : null;
    const arquivoUrlAWS = req.files?.arquivo
      ? await awsUtils.uploadFile(req.files.arquivo[0], 'arquivos', tenantId)
      : null;

    if (req.body.natureza === 'COMISSIONADO') {
      const cargo = await CargoComissionado.buscarPorNome(req.body.funcao, tenantId);

      if (!cargo) {
        throw new Error('Cargo comissionado não encontrado.');
      }

      const simbologia = await CargoComissionado.buscarPorSimbologia(
        cargo.simbologia,
        tenantId
      );

      if (!simbologia) {
        throw new Error('Simbologia não encontrada para o cargo.');
      }

      if (simbologia.limite === 0) {
        throw new Error('Não é possível criar funcionário: limite atingido.');
      }

      await CargoComissionado.updateLimite(
        simbologia.simbologia,
        simbologia.limite - 1,
        tenantId
      );
    }

    const setorId = resolveSetorId(req.body);
    if (!setorId) {
      throw new AppError('Lotação (setorId) obrigatória.', 400, 'BAD_REQUEST');
    }

    const { coordenadoria: _ignored, ...restBody } = req.body;

    const funcionarioCriado = await FuncionarioRepository.create({
      ...restBody,
      setorId,
      observacoes: normalizeObservacoes(req.body.observacoes || []),
      foto: fotoUrlAWS,
      arquivo: arquivoUrlAWS,
      tenantId,
      createdBy: req.user?.id || null,
    });

    const setor = await SetorRepository.findSetorByCoordenadoria(
      [funcionarioCriado.setorId],
      tenantId
    );

    await CacheService.clearCacheForFuncionarios(
      funcionarioCriado.setorId,
      setor[0]?.parent
    );

    return {
      ...funcionarioCriado.toObject(),
      fotoUrl: fotoUrlAWS
        ? await awsUtils.gerarUrlPreAssinada(fotoUrlAWS)
        : null,
      arquivoUrl: arquivoUrlAWS
        ? await awsUtils.gerarUrlPreAssinada(arquivoUrlAWS)
        : null,
    };
  }

 static async execute(params, body, files, tenantId = null) {
  const { id } = params;

  const funcionarioExistente = await FuncionarioRepository.findByIds(
    id,
    tenantId
  );
  if (!funcionarioExistente || funcionarioExistente.length === 0) {
    throw new Error('Funcionário não encontrado');
  }

  const atual = funcionarioExistente[0];

  const novaFuncao = body.funcao;
  const novaNatureza = body.natureza;

  if (novaFuncao !== atual.funcao) {
    await LimiteService.atualizarLimitesDeFuncao(
      atual.funcao,
      novaFuncao,
      atual.natureza,
      novaNatureza,
      tenantId
    );
  }

  const fotoUrlAWS = files?.foto
    ? await awsUtils.uploadFile(files.foto[0], 'fotos', tenantId)
    : atual.foto;

  const arquivoUrlAWS = files?.arquivo
    ? await awsUtils.uploadFile(files.arquivo[0], 'arquivos', tenantId)
    : atual.arquivo;

  const setorId = resolveSetorId(body) || lotacaoIdOf(atual);
  const { coordenadoria: _ignored, ...restBody } = body;

  const funcionarioAtualizado = await FuncionarioRepository.update(
    id,
    {
      ...restBody,
      setorId,
      foto: fotoUrlAWS,
      arquivo: arquivoUrlAWS,
      updatedBy: body.updatedBy || null,
    },
    tenantId
  );

  const setor = await SetorRepository.findSetorByCoordenadoria(
    [funcionarioAtualizado.setorId],
    tenantId
  );

  await CacheService.clearCacheForFuncionarios(
    funcionarioAtualizado.setorId,
    setor[0]?.parent
  );

  return {
    status: 200,
    data: {
      ...funcionarioAtualizado.toObject(),
      fotoUrl: fotoUrlAWS
        ? await awsUtils.gerarUrlPreAssinada(fotoUrlAWS)
        : null,
      arquivoUrl: arquivoUrlAWS
        ? await awsUtils.gerarUrlPreAssinada(arquivoUrlAWS)
        : null,
    },
  };
}


  static async deleteUsers(userIds, tenantId = null) {
    try {
      const setoresAfetados = new Set();
      const batchPromises = [];
      const cargosComissionados = new Map();

      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);

        batchPromises.push(
          (async () => {
            const funcionarios = await FuncionarioRepository.findByIds(
              batch,
              tenantId
            );

            funcionarios.forEach((func) => {
              const lotacao = lotacaoIdOf(func);
              if (lotacao) {
                setoresAfetados.add(lotacao);
              }

              if (func.natureza === 'COMISSIONADO' && func.funcao) {
                const atual = cargosComissionados.get(func.funcao) || 0;
                cargosComissionados.set(func.funcao, atual + 1);
              }
            });

            return FuncionarioRepository.deleteBatch(batch, tenantId);
          })()
        );
      }

      await Promise.all(batchPromises);

      for (const [nomeFuncao, qtd] of cargosComissionados) {
        const cargo = await CargoComissionado.buscarPorNome(nomeFuncao, tenantId);
        if (cargo && cargo.simbologia) {
          const simbologiaAtual = await CargoComissionado.buscarPorSimbologia(
            cargo.simbologia,
            tenantId
          );
          const novoLimite = (simbologiaAtual?.limite || 0) + qtd;
          await CargoComissionado.updateLimite(
            cargo.simbologia,
            novoLimite,
            tenantId
          );
        }
      }

      const setoresAfetadosArray = Array.from(setoresAfetados);
      const setores = await SetorRepository.findSetorByCoordenadoria(
        setoresAfetadosArray,
        tenantId
      );

      const setoresParaLimparCache = [...setoresAfetadosArray];
      setores.forEach((setor) => {
        if (setor.parent) {
          setoresParaLimparCache.push(setor.parent);
        }
      });

      await CacheService.clearCacheForFuncionarios(setoresParaLimparCache);
    } catch (error) {
      console.error('Erro ao deletar usuários:', error);
      throw error;
    }
  }

  static async updateCoordinatoria(userIds, newCoordId, tenantId = null) {
    return this.updateLotacao(userIds, newCoordId, tenantId);
  }

  static async updateLotacao(userIds, newSetorId, tenantId = null) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError('Lista de usuários inválida.', 400, 'BAD_REQUEST');
    }
    if (!newSetorId) {
      throw new AppError('Setor de destino obrigatório.', 400, 'BAD_REQUEST');
    }

    const users = await FuncionarioRepository.findByIds(userIds, tenantId);
    if (!users.length) {
      throw new AppError('Nenhum funcionário encontrado.', 404, 'NOT_FOUND');
    }

    const oldSetorIds = users
      .map((u) => lotacaoIdOf(u)?.toString())
      .filter((id) => id);

    const oldSetores = await SetorRepository.findSetorByCoordenadoria(
      oldSetorIds,
      tenantId
    );
    const parentIds = oldSetores.map((c) => c.parent).filter(Boolean);

    await FuncionarioRepository.updateSetorId(userIds, newSetorId, tenantId);

    try {
      await CacheService.clearCacheForCoordChange(
        oldSetorIds,
        newSetorId,
        parentIds
      );
    } catch (cacheErr) {
      console.error('Falha ao limpar cache após transferência:', cacheErr);
    }

    return FuncionarioRepository.findByIds(userIds, tenantId);
  }

  static async updateObservacoes(userId, observacoes, tenantId = null) {
    const user = await FuncionarioRepository.findByIds(userId, tenantId);

    if (!user || !user.length) {
      throw new Error('Usuário não encontrado.');
    }

    const normalized = normalizeObservacoes(observacoes, {
      assignMissingDate: true,
    });

    const updatedFuncionario = await FuncionarioRepository.updateObservacoes(
      userId,
      normalized,
      tenantId
    );

    const lotacao = lotacaoIdOf(updatedFuncionario);
    const setor = await SetorRepository.findSetorByCoordenadoria(
      [lotacao],
      tenantId
    );

    await CacheService.clearCacheForFuncionarios(
      lotacao,
      setor[0]?.parent
    );

    return updatedFuncionario;
  }

  static async checkNameAvailability(name, tenantId = null) {
    if (!name || name.trim().length < 3) {
      return {
        available: true,
        message: 'Digite pelo menos 3 caracteres',
        statusCode: 400,
      };
    }

    const normalizedName = normalizarTexto(name);

    const existingFuncionario =
      await FuncionarioRepository.findByName(normalizedName, tenantId);

    if (existingFuncionario) {
      return {
        available: false,
        message: 'Já existe um funcionário ativo com este nome',
        statusCode: 200,
      };
    }

    return {
      available: true,
      message: 'Nome disponível',
      statusCode: 200,
    };
  }

  static async hasFuncionarios(entityId) {
    const entity = await SetorRepository.findById(entityId);
    if (!entity) {
      throw new Error('Entidade não encontrada');
    }

    const count = await FuncionarioRepository.countBySetor(entityId);
    return count > 0;
  }
}

module.exports = FuncionarioService;
