const mongoose = require('mongoose');
const FuncionarioRepository = require('../repositories/FuncionariosRepository');
const CargoComissionado = require('../repositories/cargoComissionadoRepository');
const CacheService = require('../services/CacheService');
const awsUtils = require('../utils/awsUtils');
const LimiteService = require('../utils/LimiteService');

const BATCH_SIZE = 100;

class FuncionarioService {
  static async buscarFuncionarios() {
    return await CacheService.getOrSetCache(`todos:funcionarios`, async () => {
      const funcionarios = await FuncionarioRepository.findAll();

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
    });
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

  static async buscarFuncionariosPorSetor(idSetor) {
    const objectId = mongoose.Types.ObjectId.isValid(idSetor)
      ? new mongoose.Types.ObjectId(idSetor)
      : idSetor;

    const funcionarios =
      await FuncionarioRepository.buscarFuncionariosPorSetor(objectId);

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

  static async createFuncionario(req) {
    const fotoUrlAWS = req.files?.foto
      ? await awsUtils.uploadFile(req.files.foto[0], 'fotos')
      : null;
    const arquivoUrlAWS = req.files?.arquivo
      ? await awsUtils.uploadFile(req.files.arquivo[0], 'arquivos')
      : null;

    if (req.body.natureza === 'COMISSIONADO') {
      console.log('funcao:', req.body.funcao);
      const cargo = await CargoComissionado.buscarPorNome(req.body.funcao);

      console.log('Cargo encontrado:', cargo);

      if (cargo.limite === 0) {
        throw new Error('Não é possível criar funcionário: limite atingido.');
      }

      await CargoComissionado.updateLimit(cargo._id, cargo.limite - 1);
    }

    const funcionarioCriado = await FuncionarioRepository.create({
      ...req.body,
      foto: fotoUrlAWS,
      arquivo: arquivoUrlAWS,
    });

    await CacheService.clearCacheForFuncionarios(
      funcionarioCriado.coordenadoria
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
    await CacheService.clearCacheForFuncionarios(
      funcionarioAtualizado.coordenadoria
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
      const cargosComissionados = new Set();
      let funcionariosComissionados = 0;

      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);

        batchPromises.push(
          (async () => {
            const funcionarios = await FuncionarioRepository.findByIds(batch);

            funcionariosComissionados += funcionarios.filter(
              (f) => f.natureza === 'COMISSIONADO'
            ).length;

            funcionarios.forEach((func) => {
              if (func.coordenadoria) {
                setoresAfetados.add(func.coordenadoria);
              }

              if (func.natureza === 'COMISSIONADO' && func.funcao) {
                cargosComissionados.add(func.funcao);
              }
            });

            return FuncionarioRepository.deleteBatch(batch);
          })()
        );
      }

      await Promise.all(batchPromises);

      for (const nomeFuncao of cargosComissionados) {
        const cargo = await CargoComissionado.buscarPorNome(nomeFuncao);
        if (cargo) {
          await CargoComissionado.updateLimit(
            cargo._id,
            cargo.limite + funcionariosComissionados
          );
        }
      }

      if (setoresAfetados.size > 0) {
        await CacheService.clearCacheForFuncionarios(...setoresAfetados);
      }

      return {
        success: true,
        message: 'Usuários deletados e cache atualizado.',
      };
    } catch (error) {
      console.error('Erro ao deletar usuários:', error);
      throw new Error('Erro ao processar exclusão de usuários.');
    }
  }

  static async updateCoordinatoria(userIds, newCoordId) {
    const users = await FuncionarioRepository.findByIds(userIds);
    const oldCoordIds = users
      .map((u) => u.coordenadoria?.toString())
      .filter((id) => id);

    await FuncionarioRepository.updateCoordenadoria(userIds, newCoordId);

    await CacheService.clearCacheForCoordChange(oldCoordIds, newCoordId);

    return FuncionarioRepository.findByIds(userIds);
  }

  static async updateObservacoes(userId, observacoes) {
    const user = await FuncionarioRepository.findByIds(userId);

    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    user.observacoes = observacoes;

    const updatedFuncionario = await FuncionarioRepository.updateObservacoes(
      userId,
      observacoes
    );

    // Lógica de cache abstraída
    await CacheService.clearCacheForFuncionarios(user.coordenadoria);

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

    const existingFuncionario = await FuncionarioRepository.findByName(name);

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
}

module.exports = FuncionarioService;
