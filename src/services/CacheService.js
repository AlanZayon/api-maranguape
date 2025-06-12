const redisClient = require('../config/redisClient');

class CacheService {
  static async getOrSetCache(key, fetchFunction) {
    const cachedData = await redisClient.get(key);
    if (cachedData) return JSON.parse(cachedData);
    const freshData = await fetchFunction();
    if (freshData?.funcionarios?.length) {
      await redisClient.setex(key, 3600, JSON.stringify(freshData));
    }

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
    const flatKeys = keys.flat(Infinity);
    const uniqueKeys = [...new Set(flatKeys)];
    for (const key of uniqueKeys) {
      const setorKeys = await redisClient.keys(
        `setor:${key}:funcionarios:page:*`
      );
      if (setorKeys.length > 0) {
        await redisClient.del(...setorKeys);
      }

      const coordenadoriaKey = `coordenadoria:${key}:funcionarios`;
      await redisClient.del(coordenadoriaKey);
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
      const coordKey = `coordenadoria:${key}:funcionarios`;
      await redisClient.del(coordKey);

      const setorPattern = `setor:${key}:funcionarios:page:*`;
      const setorKeys = await redisClient.keys(setorPattern);
      if (setorKeys.length > 0) {
        await redisClient.del(...setorKeys);
      }
    }

    const todosFuncionariosKeys = await redisClient.keys(
      'todos:funcionarios:page*'
    );
    if (todosFuncionariosKeys.length > 0) {
      await redisClient.del(...todosFuncionariosKeys);
    }

    const totalKey = 'funcionarios:total';
    await redisClient.del(totalKey);

    const cargosKey = 'todos:cargosComissionados';
    await redisClient.del(cargosKey);
  }
}

module.exports = CacheService;
