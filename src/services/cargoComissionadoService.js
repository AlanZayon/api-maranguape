const CargoComissionadoRepository = require('../repositories/cargoComissionadoRepository');
const CacheService = require('../services/CacheService');

class CargoComissionadoService {
  static async listarCargos() {
    return await CacheService.getOrSetCache(
      `todos:cargosComissionados`,
      async () => {
        return await CargoComissionadoRepository.buscarTodos();
      }
    );
  }
}

module.exports = CargoComissionadoService;
