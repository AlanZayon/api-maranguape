const redisClient = require('../config/redisClient');

class CacheService {
  static async getOrSetCache(key, fetchFunction) {
    const cachedData = await redisClient.get(key);
    if (cachedData) return JSON.parse(cachedData);
    const freshData = await fetchFunction();
    await redisClient.setex(key, 3600, JSON.stringify(freshData));
    return freshData;
  }

  static async clearCacheForSetor(...ids) {
    const scanKeys = async (pattern) => {
      let cursor = '0';
      let keys = [];

      do {
        const result = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = result[0];
        keys = keys.concat(result[1]);
      } while (cursor !== '0');

      return keys;
    };

    await Promise.all(
      ids.map(async (id) => {
        const possibleSetorKey = `setor:${id}:dados`;
        const existsAsSetor = await redisClient.exists(possibleSetorKey);

        if (existsAsSetor) {
          await redisClient.del(possibleSetorKey);
        } else {
          const allSetorKeys = await scanKeys('setor:*:dados');

          for (const key of allSetorKeys) {
            const data = await redisClient.get(key);
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              const subsetores = parsed.subsetores || [];
              const found = subsetores.find((s) => s._id === id);

              if (found) {
                await redisClient.del(key);
                break;
              }
            } catch (err) {
              console.error(`Erro ao parsear cache ${key}:`, err.message);
            }
          }
        }
      })
    );

    await Promise.all([
      redisClient.del('setores:null'),
      redisClient.del('setoresOrganizados'),
    ]);
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
