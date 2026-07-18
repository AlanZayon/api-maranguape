const ReferencesRepository = require('../repositories/referencesRepository');
const FuncionarioRepository = require('../repositories/FuncionariosRepository');

class ReferencesService {
  static async registerReference(payload = {}) {
    const { funcionarioId, name, cargo, telefone } = payload;

    if (funcionarioId) {
      return this.registerFromFuncionario(funcionarioId);
    }

    return this.registerExterna({ name, cargo, telefone });
  }

  static async registerFromFuncionario(funcionarioId) {
    const funcionario = await FuncionarioRepository.findById(funcionarioId);
    if (!funcionario) {
      throw new Error('Funcionário não encontrado!');
    }

    const alreadyLinked =
      await ReferencesRepository.findReferenceByFuncionarioId(funcionarioId);
    if (alreadyLinked) {
      throw new Error('Este funcionário já está cadastrado como referência!');
    }

    const name = String(funcionario.nome || '').trim().toUpperCase();
    if (!name) {
      throw new Error('Funcionário sem nome válido!');
    }

    const existingByName = await ReferencesRepository.findReferenceByName(name);
    if (existingByName) {
      throw new Error('Já existe uma referência com este nome!');
    }

    const newReference = await ReferencesRepository.createReference({
      name,
      cargo: (funcionario.funcao || '').toUpperCase() || undefined,
      telefone: funcionario.telefone?.trim() || undefined,
      origem: 'funcionario',
      funcionarioId: funcionario._id,
    });

    await this.pushToCache(newReference);
    return newReference;
  }

  static async registerExterna({ name, cargo, telefone }) {
    if (!name) {
      throw new Error('Todos os campos são obrigatórios!');
    }

    name = String(name).trim().toUpperCase();
    cargo = cargo?.toUpperCase();
    telefone = telefone?.trim();

    const existingReference = await ReferencesRepository.findReferenceByName(name);
    if (existingReference) {
      throw new Error('Já existe uma referência com este nome e sobrenome!');
    }

    const newReference = await ReferencesRepository.createReference({
      name,
      cargo,
      telefone,
      origem: 'externa',
    });

    await this.pushToCache(newReference);
    return newReference;
  }

  static async pushToCache(newReference) {
    const currentCache =
      (await ReferencesRepository.getRedisCache('referencias-dados')) || [];
    currentCache.push(newReference);
    await ReferencesRepository.setRedisCache('referencias-dados', currentCache);
  }

  static async getReferences() {
    const cacheData = await ReferencesRepository.getRedisCache('referencias-dados');
    if (cacheData) {
      return cacheData;
    }

    const references = await ReferencesRepository.getAllReferences();
    await ReferencesRepository.setRedisCache('referencias-dados', references);
    return references;
  }

  static async deleteReference(id) {
    const reference = await ReferencesRepository.deleteReferenceById(id);
    if (!reference) {
      throw new Error('Referência não encontrada!');
    }

    let currentCache =
      (await ReferencesRepository.getRedisCache('referencias-dados')) || [];
    currentCache = currentCache.filter((ref) => ref._id.toString() !== id);
    await ReferencesRepository.setRedisCache('referencias-dados', currentCache);

    return reference;
  }
}

module.exports = ReferencesService;
