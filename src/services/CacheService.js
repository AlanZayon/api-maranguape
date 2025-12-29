const redisClient = require('../config/redisClient');

class CacheService {
static async getOrSetCache(key, fetchFunction) {
  const start = process.hrtime.bigint();

  const cachedData = await redisClient.get(key);
  if (cachedData) {
    metrics.cacheHits.inc();
    metrics.cacheLatency
      .labels("hit")
      .observe(
        Number(process.hrtime.bigint() - start) / 1e6
      );

    return JSON.parse(cachedData);
  }

  metrics.cacheMisses.inc();

  const freshData = await fetchFunction();

  if (freshData?.funcionarios?.length) {
    await redisClient.setex(key, 3600, JSON.stringify(freshData));
  }

  metrics.cacheLatency
    .labels("miss")
    .observe(
      Number(process.hrtime.bigint() - start) / 1e6
    );

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
  await this.clearCacheForDivisoes(...keys);
  
  const flatKeys = keys.flat(Infinity);
  const uniqueKeys = [...new Set(flatKeys)];
  
  const patterns = [
    'setor:*:funcionarios:*',
    'coordenadoria:*:funcionarios',
    'todos:funcionarios:page*',
    'funcionarios:total',
    'todos:cargosComissionados'
  ];

  await Promise.all([
    ...uniqueKeys.map(id => redisClient.del(`divisoes:${id}:*`)),
    ...patterns.map(p => redisClient.keys(p).then(keys => 
      keys.length > 0 ? redisClient.del(...keys) : null
    ))
  ]);
}

  static async clearCacheForDivisoes(...idsDivisoes) {
  const uniqueIds = [...new Set(idsDivisoes.flat(Infinity))];
  
  // Gera TODOS os padrões possíveis que podem conter esses IDs
  const patternsToClear = [
    'divisoes:*', // Todas as combinações (incluindo páginas)
    ...uniqueIds.map(id => `divisoes:*${id}*:*`), // Padrão otimizado para Redis
    ...uniqueIds.map(id => `*:${id}:*`) // Fallback para outros formatos
  ];

  // Busca paralela das chaves
  const keysToDelete = new Set();
  
  await Promise.all(
    patternsToClear.map(async (pattern) => {
      try {
        const keys = await redisClient.keys(pattern);
        keys.forEach(key => {
          // Filtro adicional para garantir que estamos limpando apenas caches de divisões
          if (key.includes('divisoes:') && key.includes(':page')) {
            keysToDelete.add(key);
          }
        });
      } catch (error) {
        console.error(`Erro ao buscar chaves com padrão ${pattern}:`, error);
      }
    })
  );

  if (keysToDelete.size > 0) {
    await redisClient.del(...Array.from(keysToDelete));
    console.log(`[CACHE] Limpas ${keysToDelete.size} chaves:`, Array.from(keysToDelete));
  }
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
