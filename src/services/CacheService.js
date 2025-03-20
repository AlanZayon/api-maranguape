const redisClient = require('../config/redisClient');

class CacheService {
  static async getOrSetCache(key, fetchFunction) {
    console.log('Checking cache for', key);
    const cachedData = await redisClient.get(key);
    console.log('Cache found for', cachedData);
    if (cachedData) return JSON.parse(cachedData);
    const freshData = await fetchFunction();
    console.log('Setting cache for', key);
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
    }
    await redisClient.del('todos:funcionarios');
    await redisClient.del('todos:cargosComissionados');
  }
}

module.exports = CacheService;
