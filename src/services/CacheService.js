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
}

module.exports = CacheService;
