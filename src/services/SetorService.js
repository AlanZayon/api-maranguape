const SetorRepository = require('../repositories/SetorRepository');
const CacheService = require('../services/CacheService');
const organizarSetores = require('../utils/organizarSetores');

class SetorService {
  static async createSetor(data) {
    const { nome, tipo, parent } = data;
    const setor = await SetorRepository.create({ nome, tipo, parent });
    await CacheService.clearCacheForSetor(parent, setor._id);
    return setor;
  }

  static async getSetoresOrganizados() {
    return await CacheService.getOrSetCache('setoresOrganizados', async () => {
      const setores = await SetorRepository.getAllSetores();
      const setoresOrganizados = organizarSetores(setores);
      return setoresOrganizados;
    });
  }

  static async getMainSetores() {
    return await CacheService.getOrSetCache('setores:null', async () => {
      return await SetorRepository.findMainSetores();
    });
  }

  static async getSetorData(setorId) {
    return await CacheService.getOrSetCache(
      `setor:${setorId}:dados`,
      async () => {
        const subsetores = await SetorRepository.findSetorData(setorId);
        return { subsetores };
      }
    );
  }

  static async renameSetor(id, nome) {
    const setor = await SetorRepository.updateNome(id, nome);
    await CacheService.clearCacheForSetor(setor.parent);
    return setor;
  }

  static async deleteSetor(id) {
    await SetorRepository.deleteWithChildren(id);
    await CacheService.clearCacheForSetor(id);
  }
}

module.exports = SetorService;
