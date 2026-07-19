const ReferencesRepository = require('../repositories/referencesRepository');
const FuncionarioRepository = require('../repositories/FuncionariosRepository');

class ReferencesService {
  static async registerReference(payload = {}, tenantId = null, userId = null) {
    const { funcionarioId, name, cargo, telefone } = payload;

    if (funcionarioId) {
      return this.registerFromFuncionario(funcionarioId, tenantId, userId);
    }

    return this.registerExterna({ name, cargo, telefone }, tenantId, userId);
  }

  static async registerFromFuncionario(funcionarioId, tenantId = null, userId = null) {
    const funcionario = await FuncionarioRepository.findById(
      funcionarioId,
      tenantId
    );
    if (!funcionario) {
      throw new Error('Funcionário não encontrado!');
    }

    const alreadyLinked =
      await ReferencesRepository.findReferenceByFuncionarioId(
        funcionarioId,
        tenantId
      );
    if (alreadyLinked) {
      throw new Error('Este funcionário já está cadastrado como referência!');
    }

    const name = String(funcionario.nome || '').trim().toUpperCase();
    if (!name) {
      throw new Error('Funcionário sem nome válido!');
    }

    const existingByName = await ReferencesRepository.findReferenceByName(
      name,
      tenantId
    );
    if (existingByName) {
      throw new Error('Já existe uma referência com este nome!');
    }

    const newReference = await ReferencesRepository.createReference({
      name,
      cargo: (funcionario.funcao || '').toUpperCase() || undefined,
      telefone: funcionario.telefone?.trim() || undefined,
      origem: 'funcionario',
      funcionarioId: funcionario._id,
      tenantId,
      createdBy: userId,
    });

    await this.pushToCache(newReference, tenantId);
    return newReference;
  }

  static async registerExterna({ name, cargo, telefone }, tenantId = null, userId = null) {
    if (!name) {
      throw new Error('Todos os campos são obrigatórios!');
    }

    name = String(name).trim().toUpperCase();
    cargo = cargo?.toUpperCase();
    telefone = telefone?.trim();

    const existingReference = await ReferencesRepository.findReferenceByName(
      name,
      tenantId
    );
    if (existingReference) {
      throw new Error('Já existe uma referência com este nome e sobrenome!');
    }

    const newReference = await ReferencesRepository.createReference({
      name,
      cargo,
      telefone,
      origem: 'externa',
      tenantId,
      createdBy: userId,
    });

    await this.pushToCache(newReference, tenantId);
    return newReference;
  }

  static async pushToCache(newReference, tenantId = null) {
    const key = ReferencesRepository.cacheKeyFor(tenantId);
    const currentCache =
      (await ReferencesRepository.getRedisCache(key)) || [];
    currentCache.push(newReference);
    await ReferencesRepository.setRedisCache(key, currentCache);
  }

  static async getReferences(tenantId = null) {
    const key = ReferencesRepository.cacheKeyFor(tenantId);
    const cacheData = await ReferencesRepository.getRedisCache(key);
    if (cacheData) {
      return cacheData;
    }

    const references = await ReferencesRepository.getAllReferences(tenantId);
    await ReferencesRepository.setRedisCache(key, references);
    return references;
  }

  static async deleteReference(id, tenantId = null) {
    const reference = await ReferencesRepository.deleteReferenceById(
      id,
      tenantId
    );
    if (!reference) {
      throw new Error('Referência não encontrada!');
    }

    const key = ReferencesRepository.cacheKeyFor(tenantId);
    let currentCache =
      (await ReferencesRepository.getRedisCache(key)) || [];
    currentCache = currentCache.filter((ref) => ref._id.toString() !== id);
    await ReferencesRepository.setRedisCache(key, currentCache);

    return reference;
  }
}

module.exports = ReferencesService;
