const redisClient = require('../config/redisClient');

class CacheService {
  static async getOrSetCache(key, fetchFunction) {
    const cachedData = await redisClient.get(key);
    if (cachedData) return JSON.parse(cachedData);
    const freshData = await fetchFunction();
    await redisClient.setex(key, 3600, JSON.stringify(freshData));
    return freshData;
  }

  static async clearCacheForSetor(id) {
    const setorKey = `setor:${id}:dados`;
    const existsAsSetor = await redisClient.exists(setorKey);

    if (existsAsSetor) {
      await redisClient.del(setorKey);
    } else {
      const allSetorKeys = await redisClient.keys('setor:*:dados');

      for (const key of allSetorKeys) {
        const data = await redisClient.get(key);
        if (!data) continue;

        try {
          const parsed = JSON.parse(data);
          const subsetores = parsed.subsetores || [];
          const found = subsetores.some((s) => s._id === id);

          if (found) {
            await redisClient.del(key);
            break;
          }
        } catch (err) {
          console.error(`Erro ao parsear cache ${key}:`, err.message);
        }
      }
    }

    await Promise.all([
      redisClient.del('setores:null'),
      redisClient.del('setoresOrganizados'),
    ]);
  }

  static async clearCacheForFuncionarios(...keys) {
    for (const key of keys) {
      const setorKeys = await redisClient.keys(
        `setor:${key}:funcionarios:page:*`
      );
      if (setorKeys.length > 0) {
        await redisClient.del(...setorKeys);
      }

      await redisClient.del(`coordenadoria:${key}:funcionarios`);
    }

    const todosFuncionariosKeys = await redisClient.keys(
      'todos:funcionarios:page*'
    );
    if (todosFuncionariosKeys.length > 0) {
      await redisClient.del(...todosFuncionariosKeys);
    }

    await redisClient.del('funcionarios:total');
    await redisClient.del('todos:cargosComissionados');
  }

  static async clearCacheForCoordChange(
    oldCoordIds,
    newCoordId,
    parentIds = []
  ) {
    const keys = [...new Set([...oldCoordIds, newCoordId, ...parentIds])];

    for (const key of keys) {
      await redisClient.del(`coordenadoria:${key}:funcionarios`);
      await redisClient.del(`setor:${key}:funcionarios`);
    }

    const todosFuncionariosKeys = await redisClient.keys(
      'todos:funcionarios:page*'
    );
    if (todosFuncionariosKeys.length > 0) {
      await redisClient.del(...todosFuncionariosKeys);
    }
    await redisClient.del('funcionarios:total');
    await redisClient.del('todos:cargosComissionados');
  }
}

module.exports = CacheService;
