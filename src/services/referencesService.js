const ReferencesRepository = require('../repositories/referencesRepository');

class ReferencesService {
  static async registerReference({ name, cargo, telefone }) {
    if (!name) {
      throw new Error('Todos os campos são obrigatórios!');
    }

    name = name.toUpperCase();
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
    });

    const currentCache =
      (await ReferencesRepository.getRedisCache('referencias-dados')) || [];
    currentCache.push(newReference);
    await ReferencesRepository.setRedisCache('referencias-dados', currentCache);

    return newReference;
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