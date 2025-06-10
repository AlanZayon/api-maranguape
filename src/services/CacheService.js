const redisClient = require('../config/redisClient');

class CacheService {
  static async getOrSetCache(key, fetchFunction) {
    const cachedData = await redisClient.get(key);
    console.log(`🔍 Verificando cache para a chave: ${key}`);
    console.log(`🔍 Verificando cache: ${cachedData}`);
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
    console.log(`🔍 Limpando cache para as chaves: ${keys}`);
    for (const key of keys) {
      const setorKeys = await redisClient.keys(`setor:*:funcionarios:page:*`);
      if (setorKeys.length > 0) {
        await redisClient.del(...setorKeys);
        console.log(`🧹 Limpou setorKeys: ${setorKeys.join(', ')}`);
      } else {
        console.log(`ℹ️ Nenhum cache encontrado para setor:${key}`);
      }

      const coordenadoriaKey = `coordenadoria:${key}:funcionarios`;
      const deletedCoord = await redisClient.del(coordenadoriaKey);
      if (deletedCoord) {
        console.log(`🧹 Limpou ${coordenadoriaKey}`);
      } else {
        console.log(`ℹ️ Chave não encontrada: ${coordenadoriaKey}`);
      }
    }

    const todosFuncionariosKeys = await redisClient.keys(
      'todos:funcionarios:page*'
    );
    if (todosFuncionariosKeys.length > 0) {
      await redisClient.del(...todosFuncionariosKeys);
      console.log(
        `🧹 Limpou todosFuncionariosKeys: ${todosFuncionariosKeys.join(', ')}`
      );
    } else {
      console.log(`ℹ️ Nenhum cache encontrado para todos:funcionarios:page*`);
    }

    const totalDeleted = await redisClient.del('funcionarios:total');
    console.log(
      totalDeleted
        ? '🧹 Limpou funcionarios:total'
        : 'ℹ️ funcionarios:total não encontrado'
    );

    const cargosDeleted = await redisClient.del('todos:cargosComissionados');
    console.log(
      cargosDeleted
        ? '🧹 Limpou todos:cargosComissionados'
        : 'ℹ️ todos:cargosComissionados não encontrado'
    );
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
