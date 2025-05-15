const redisClient = require('../config/redisClient');

class CacheService {
  static async getOrSetCache(key, fetchFunction) {
    const cachedData = await redisClient.get(key);
    if (cachedData) return JSON.parse(cachedData);
    const freshData = await fetchFunction();
    await redisClient.setex(key, 3600, JSON.stringify(freshData));
    return freshData;
  }

  static async clearCacheForSetor(...keys) {
    for (const key of keys) {
      await redisClient.del(`setor:${key}:dados`);
    }
    await redisClient.del('setores:null');
    await redisClient.del('setoresOrganizados');
  }

  static async clearCacheForFuncionarios(...keys) {
    for (const key of keys) {
      await redisClient.del(`coordenadoria:${key}:funcionarios`);
      await redisClient.del(`setor:${key}:funcionarios`);
    }
    await redisClient.del('todos:funcionarios');
    await redisClient.del('todos:cargosComissionados');
  }

  static async clearCacheForCoordChange(oldCoordIds, newCoordId) {
    const keys = [...new Set([...oldCoordIds, newCoordId])];

    for (const key of keys) {
      await redisClient.del(`coordenadoria:${key}:funcionarios`);
      await redisClient.del(`setor:${key}:funcionarios`);
    }

    await redisClient.del('todos:funcionarios');
    await redisClient.del('todos:cargosComissionados');
  }
}

module.exports = CacheService;
