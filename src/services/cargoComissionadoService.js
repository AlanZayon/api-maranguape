const CargoComissionadoRepository = require('../repositories/cargoComissionadoRepository');
const CacheService = require('../services/CacheService');

/**
 * Service layer for commissioned positions.
 * Uses caching to avoid repeated repository reads.
 */
class CargoComissionadoService {
  /**
   * List all commissioned positions with caching.
   *
   * Returns cached data when available to minimize repository access.
   *
   * @returns {Promise<any[]>} Array of commissioned positions.
   */
  static async listarCargos() {
    // Cache results under a stable key to reduce DB load across requests.
    return await CacheService.getOrSetCache(
      `todos:cargosComissionados`,
      async () => {
        return await CargoComissionadoRepository.buscarTodos();
      }
    );
  }
}

module.exports = CargoComissionadoService;
