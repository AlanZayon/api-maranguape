const redisClient = require('../config/redisClient');

/**
 * Versioned cache invalidation.
 * Keys are stored as:
 *   tenant:{id}:v{n}:{suffix}  or  v{n}:{suffix}
 * Invalidation increments tenant:{id}:cache:v (or global cache:v) — no SCAN.
 */
class CacheService {
  static versionCounterKey(tenantId = null) {
    return tenantId ? `tenant:${tenantId}:cache:v` : 'cache:v';
  }

  static extractTenantId(key) {
    const m = /^tenant:([^:]+):/.exec(String(key));
    if (!m) return null;
    // Never treat the version counter itself as a data key tenant parse target beyond id
    return m[1];
  }

  /**
   * Prefer tenant-prefixed keys when tenantId is known.
   */
  static tenantKey(tenantId, suffix) {
    if (!suffix) return tenantId ? `tenant:${tenantId}:` : '';
    return tenantId ? `tenant:${tenantId}:${suffix}` : String(suffix);
  }

  static async getVersion(tenantId = null) {
    const v = await redisClient.get(this.versionCounterKey(tenantId));
    return v || '0';
  }

  static async bumpVersion(tenantId = null) {
    return redisClient.incr(this.versionCounterKey(tenantId));
  }

  /**
   * Inject cache version into a logical key.
   * tenant:{id}:foo → tenant:{id}:v{n}:foo
   * foo → v{n}:foo
   */
  static async resolveKey(key) {
    const raw = String(key);
    if (raw.endsWith(':cache:v') || raw === 'cache:v') {
      return raw;
    }

    const tenantId = this.extractTenantId(raw);
    const version = await this.getVersion(tenantId);

    if (tenantId) {
      return raw.replace(
        `tenant:${tenantId}:`,
        `tenant:${tenantId}:v${version}:`
      );
    }

    return `v${version}:${raw}`;
  }

  static async getOrSetCache(key, fetchFunction, ttlSeconds = 3600) {
    const cacheKey = await this.resolveKey(key);
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
   * Invalidate setor-related list caches via version bump.
   * Also deletes known exact legacy keys (no SCAN).
   * @param {string|ObjectId|null} id
   * @param {string|null} tenantId
   */
  static async clearCacheForSetor(id, tenantId = null) {
    const exactDeletes = [
      redisClient.del('setores:null'),
      redisClient.del('setoresOrganizados'),
    ];

    if (id != null) {
      exactDeletes.push(redisClient.del(`setor:${id}:dados`));
      if (tenantId) {
        exactDeletes.push(
          redisClient.del(`tenant:${tenantId}:setor:${id}:dados`)
        );
      }
    }

    await Promise.all(exactDeletes);
    await this.bumpVersion(tenantId);
  }

  /**
   * Invalidate funcionarios list caches for a tenant (version bump).
   * @param {string|null} tenantId
   * @param {...any} _keys leftover ids kept for call-site compatibility
   */
  static async clearCacheForFuncionarios(tenantId = null, ..._keys) {
    await this.bumpVersion(tenantId);
  }

  /**
   * @deprecated Prefer clearCacheForFuncionarios(tenantId); kept as no-op bump helper.
   */
  static async clearCacheForDivisoes(tenantId = null, ..._ids) {
    await this.bumpVersion(tenantId);
  }

  static async clearCacheForCoordChange(
    tenantId,
    _oldCoordIds,
    _newCoordId,
    _parentIds = []
  ) {
    await this.bumpVersion(tenantId ?? null);
  }
}

module.exports = CacheService;
