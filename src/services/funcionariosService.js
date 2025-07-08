const mongoose = require('mongoose');
const FuncionarioRepository = require('../repositories/FuncionariosRepository');
const SetorRepository = require('../repositories/SetorRepository');
const CargoComissionado = require('../repositories/cargoComissionadoRepository');
const CacheService = require('../services/CacheService');
const awsUtils = require('../utils/awsUtils');
const LimiteService = require('../utils/LimiteService');

const BATCH_SIZE = 100;

class FuncionarioService {
  static async buscarFuncionarios(page = 1, limit = 100) {
    return await CacheService.getOrSetCache(
      `todos:funcionarios:page${page}`,
      async () => {
        const skip = (page - 1) * limit;

        const total = await FuncionarioRepository.countDocuments();

        const funcionarios = await FuncionarioRepository.findAll()
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
      }
    );
  }

  static async buscarFuncionariosPorCoordenadoria(idCoordenadoria) {
    return await CacheService.getOrSetCache(
      `coordenadoria:${idCoordenadoria}:funcionarios`,
      async () => {
        const objectId = mongoose.Types.ObjectId.isValid(idCoordenadoria)
          ? new mongoose.Types.ObjectId(idCoordenadoria)
          : idCoordenadoria;

        const funcionarios =
          await FuncionarioRepository.findByCoordenadoria(objectId);

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

  static async buscarFuncionariosPorSetor(idSetor, page = 1, limit = 100) {
    const objectId = mongoose.Types.ObjectId.isValid(idSetor)
      ? new mongoose.Types.ObjectId(idSetor)
      : idSetor;

    return await CacheService.getOrSetCache(
      `setor:${idSetor}:funcionarios:page:${page}`,
      async () => {
        const skip = (page - 1) * limit;

        const total = await FuncionarioRepository.countBySetor(objectId);

        const funcionarios =
          await FuncionarioRepository.buscarFuncionariosPorSetor(
            objectId,
            skip,
            limit
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

  static async createFuncionario(req) {
    const fotoUrlAWS = req.files?.foto
      ? await awsUtils.uploadFile(req.files.foto[0], 'fotos')
      : null;
    const arquivoUrlAWS = req.files?.arquivo
      ? await awsUtils.uploadFile(req.files.arquivo[0], 'arquivos')
      : null;

    if (req.body.natureza === 'COMISSIONADO') {
      const cargo = await CargoComissionado.buscarPorNome(req.body.funcao);

      if (!cargo) {
        throw new Error('Cargo comissionado não encontrado.');
      }

      const simbologia = await CargoComissionado.buscarPorSimbologia(
        cargo.simbologia
      );

      if (!simbologia) {
        throw new Error('Simbologia não encontrada para o cargo.');
      }

      if (simbologia.limite === 0) {
        throw new Error('Não é possível criar funcionário: limite atingido.');
      }

      await CargoComissionado.updateLimite(
        simbologia.simbologia,
        simbologia.limite - 1
      );
    }

    const funcionarioCriado = await FuncionarioRepository.create({
      ...req.body,
      foto: fotoUrlAWS,
      arquivo: arquivoUrlAWS,
    });

    const setor = await SetorRepository.findSetorByCoordenadoria([
      funcionarioCriado.coordenadoria,
    ]);

    await CacheService.clearCacheForFuncionarios(
      funcionarioCriado.coordenadoria,
      setor[0].parent
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

  static async execute(params, body, files) {
    const { id } = params;

    const funcionarioExistente = await FuncionarioRepository.findByIds(id);
    if (!funcionarioExistente)
      return { status: 404, data: { error: 'Funcionário não encontrado' } };

    const novaFuncao = body.funcao;
    const novaNatureza = body.natureza;
    const antigaFuncao = funcionarioExistente[0]?.funcao;
    const antigaNatureza = funcionarioExistente[0]?.natureza;

    if (novaFuncao !== antigaFuncao) {
      await LimiteService.atualizarLimitesDeFuncao(
        antigaFuncao,
        novaFuncao,
        antigaNatureza,
        novaNatureza
      );
    }

    const fotoUrlAWS = files?.foto
      ? await awsUtils.uploadFile(files.foto[0], 'fotos')
      : funcionarioExistente.foto;
    const arquivoUrlAWS = files?.arquivo
      ? await awsUtils.uploadFile(files.arquivo[0], 'arquivos')
      : funcionarioExistente.arquivo;

    const funcionarioAtualizado = await FuncionarioRepository.update(id, {
      ...body,
      foto: fotoUrlAWS,
      arquivo: arquivoUrlAWS,
    });

    const setor = await SetorRepository.findSetorByCoordenadoria([
      funcionarioAtualizado.coordenadoria,
    ]);

    await CacheService.clearCacheForFuncionarios(
      funcionarioAtualizado.coordenadoria,
      setor[0].parent
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

  static async deleteUsers(userIds) {
    try {
      const setoresAfetados = new Set();
      const batchPromises = [];
      const cargosComissionados = new Map(); // nomeFuncao -> count

      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);

        batchPromises.push(
          (async () => {
            const funcionarios = await FuncionarioRepository.findByIds(batch);

            funcionarios.forEach((func) => {
              if (func.coordenadoria) {
                setoresAfetados.add(func.coordenadoria);
              }

              if (func.natureza === 'COMISSIONADO' && func.funcao) {
                const atual = cargosComissionados.get(func.funcao) || 0;
                cargosComissionados.set(func.funcao, atual + 1);
              }
            });

            return FuncionarioRepository.deleteBatch(batch);
          })()
        );
      }

      await Promise.all(batchPromises);

      for (const [nomeFuncao, qtd] of cargosComissionados) {
        const cargo = await CargoComissionado.buscarPorNome(nomeFuncao);
        if (cargo && cargo.simbologia) {
          const simbologiaAtual = await CargoComissionado.buscarPorSimbologia(
            cargo.simbologia
          );
          const novoLimite = (simbologiaAtual?.limite || 0) + qtd;
          await CargoComissionado.updateLimite(cargo.simbologia, novoLimite);
        }
      }

      const setoresAfetadosArray = Array.from(setoresAfetados);
      const setores =
        await SetorRepository.findSetorByCoordenadoria(setoresAfetadosArray);

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

  static async updateCoordinatoria(userIds, newCoordId) {
    const users = await FuncionarioRepository.findByIds(userIds);
    const oldCoordIds = users
      .map((u) => u.coordenadoria?.toString())
      .filter((id) => id);

    const oldCoordenadorias =
      await SetorRepository.findSetorByCoordenadoria(oldCoordIds);
    const parentIds = oldCoordenadorias.map((c) => c.parent).filter(Boolean);

    await FuncionarioRepository.updateCoordenadoria(userIds, newCoordId);

    await CacheService.clearCacheForCoordChange(
      oldCoordIds,
      newCoordId,
      parentIds
    );

    return FuncionarioRepository.findByIds(userIds);
  }

  static async updateObservacoes(userId, observacoes) {
    const user = await FuncionarioRepository.findByIds(userId);

    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    const updatedFuncionario = await FuncionarioRepository.updateObservacoes(
      userId,
      observacoes
    );

    const setor = await SetorRepository.findSetorByCoordenadoria([
      updatedFuncionario.coordenadoria,
    ]);

    await CacheService.clearCacheForFuncionarios(
      updatedFuncionario.coordenadoria,
      setor[0].parent
    );

    return updatedFuncionario;
  }

  static async checkNameAvailability(name) {
    if (!name || name.trim().length < 3) {
      return {
        available: true,
        message: 'Digite pelo menos 3 caracteres',
        statusCode: 400,
      };
    }

    const normalizedName = normalizarTexto(name);

    const existingFuncionario =
      await FuncionarioRepository.findByName(normalizedName);

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

    if (entity.tipo === 'Coordenadoria') {
      const count = await FuncionarioRepository.countFuncionariosInCoordenadoria(entityId);
      return count > 0;
    } else {
      const coordenadoriasIds = await this.getCoordenadoriasIdsRecursive(entityId);
      const count = await FuncionarioRepository.countFuncionariosInCoordenadorias(coordenadoriasIds);
      return count > 0;
    }
  }

  static async getCoordenadoriasIdsRecursive(parentId) {
    const children = await SetorRepository.findSetorData(parentId);
    let coordenadoriasIds = [];

    for (const child of children) {
      if (child.tipo === 'Coordenadoria') {
        coordenadoriasIds.push(child._id);
      } else {
        const subCoordenadorias = await this.getCoordenadoriasIdsRecursive(child._id);
        coordenadoriasIds = [...coordenadoriasIds, ...subCoordenadorias];
      }
    }

    return coordenadoriasIds;
  }
}

const normalizarTexto = (valor) => {
  if (typeof valor !== 'string' || !valor.trim()) return valor;
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .toUpperCase();
};

module.exports = FuncionarioService;
