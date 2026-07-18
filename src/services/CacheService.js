const redisClient = require('../config/redisClient');

class CacheService {
  /**
   * Resolve a cache key, optionally supporting tenant: prefixes.
   * Callers may pass keys already prefixed with `tenant:`.
   */
  static resolveKey(key) {
    return key;
  }

  static async scanKeys(pattern) {
    const keys = [];
    let cursor = '0';

    do {
      const [nextCursor, found] = await redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      if (found?.length) {
        keys.push(...found);
      }
    } while (cursor !== '0');

    return keys;
  }

  static async deleteByPattern(pattern) {
    const keys = await this.scanKeys(pattern);
    if (keys.length === 0) return 0;

    const pipeline = redisClient.pipeline();
    for (const key of keys) {
      pipeline.del(key);
    }
    await pipeline.exec();
    return keys.length;
  }

  static async getOrSetCache(key, fetchFunction, ttlSeconds = 3600) {
    const cacheKey = this.resolveKey(key);
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const freshData = await fetchFunction();

    if (freshData !== null && freshData !== undefined) {
      await redisClient.setex(cacheKey, ttlSeconds, JSON.stringify(freshData));
    }

    return freshData;
  }

  /**
   * Clears cache for a single setor id (and shared list keys).
   * @param {string|ObjectId} id
   */
  static async clearCacheForSetor(id) {
    if (id == null) {
      await Promise.all([
        redisClient.del('setores:null'),
        redisClient.del('setoresOrganizados'),
        this.deleteByPattern('tenant:*:setores:null'),
        this.deleteByPattern('tenant:*:setoresOrganizados'),
      ]);
      return;
    }

    const setorKey = `setor:${id}:dados`;
    const existsAsSetor = await redisClient.exists(setorKey);

    if (existsAsSetor) {
      await redisClient.del(setorKey);
    } else {
      const allSetorKeys = await this.scanKeys('setor:*:dados');

      for (const key of allSetorKeys) {
        const data = await redisClient.get(key);
        if (!data) continue;

        try {
          const parsed = JSON.parse(data);
          const subsetores = parsed.subsetores || [];
          const found = subsetores.some(
            (s) => String(s._id) === String(id)
          );

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
      this.deleteByPattern('tenant:*:setores:null'),
      this.deleteByPattern('tenant:*:setoresOrganizados'),
    ]);
  }

  static async clearCacheForFuncionarios(...keys) {
    await this.clearCacheForDivisoes(...keys);

    const flatKeys = keys.flat(Infinity);
    const uniqueKeys = [...new Set(flatKeys.filter((k) => k != null))];

    const patterns = [
      'setor:*:funcionarios*',
      'coordenadoria:*:funcionarios',
      'setores:*:page*',
      'divisoes:*',
      'todos:funcionarios:page*',
      'funcionarios:total',
      'todos:cargosComissionados',
    ];

    await Promise.all([
      ...uniqueKeys.map((id) => this.deleteByPattern(`divisoes:${id}:*`)),
      ...uniqueKeys.map((id) => this.deleteByPattern(`setores:*${id}*`)),
      ...uniqueKeys.map((id) => redisClient.del(`setor:${id}:funcionarios`)),
      ...patterns.map((p) => this.deleteByPattern(p)),
    ]);
  }

  static async clearCacheForDivisoes(...idsDivisoes) {
    const uniqueIds = [
      ...new Set(idsDivisoes.flat(Infinity).filter((id) => id != null)),
    ];

    const patternsToClear = [
      'divisoes:*',
      ...uniqueIds.map((id) => `divisoes:*${id}*:*`),
      ...uniqueIds.map((id) => `*:${id}:*`),
    ];

    const keysToDelete = new Set();

    await Promise.all(
      patternsToClear.map(async (pattern) => {
        try {
          const keys = await this.scanKeys(pattern);
          keys.forEach((key) => {
            if (key.includes('divisoes:') && key.includes(':page')) {
              keysToDelete.add(key);
            }
          });
        } catch (error) {
          console.error(
            `Erro ao buscar chaves com padrão ${pattern}:`,
            error
          );
        }
      })
    );

    if (keysToDelete.size > 0) {
      const pipeline = redisClient.pipeline();
      for (const key of keysToDelete) {
        pipeline.del(key);
      }
      await pipeline.exec();
      console.log(
        `[CACHE] Limpas ${keysToDelete.size} chaves:`,
        Array.from(keysToDelete)
      );
    }
  }

  static async clearCacheForCoordChange(
    oldCoordIds,
    newCoordId,
    parentIds = []
  ) {
    const keys = [
      ...new Set(
        [...oldCoordIds, newCoordId, ...parentIds].filter((k) => k != null)
      ),
    ];

    for (const key of keys) {
      await redisClient.del(`setor:${key}:funcionarios`);
      await redisClient.del(`coordenadoria:${key}:funcionarios`);
      await this.deleteByPattern(`setor:${key}:funcionarios:page:*`);
    }

    await this.deleteByPattern('todos:funcionarios:page*');
    await redisClient.del('funcionarios:total');
    await redisClient.del('todos:cargosComissionados');
  }
}

module.exports = CacheService;
