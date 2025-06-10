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
    const normalizedName = normalizarTexto(nome);
    console.log(`Renaming setor ${id} to ${normalizedName}`);
    const setor = await SetorRepository.updateNome(id, normalizedName);
    await CacheService.clearCacheForSetor(setor.parent);
    return setor;
  }

  static async deleteSetor(id) {
    await SetorRepository.deleteWithChildren(id);
    await CacheService.clearCacheForSetor(id);
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

module.exports = SetorService;
