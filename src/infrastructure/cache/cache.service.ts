import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  versionCounterKey(tenantId: string | null = null) {
    return tenantId ? `tenant:${tenantId}:cache:v` : 'cache:v';
  }

  extractTenantId(key: string): string | null {
    const m = /^tenant:([^:]+):/.exec(String(key));
    return m ? m[1] : null;
  }

  tenantKey(tenantId: string | null | undefined, suffix: string) {
    if (!suffix) return tenantId ? `tenant:${tenantId}:` : '';
    return tenantId ? `tenant:${tenantId}:${suffix}` : String(suffix);
  }

  async getVersion(tenantId: string | null = null) {
    const v = await this.redis.get(this.versionCounterKey(tenantId));
    return v || '0';
  }

  async bumpVersion(tenantId: string | null = null) {
    return this.redis.incr(this.versionCounterKey(tenantId));
  }

  async resolveKey(key: string) {
    const raw = String(key);
    if (raw.endsWith(':cache:v') || raw === 'cache:v') return raw;

    const tenantId = this.extractTenantId(raw);
    const version = await this.getVersion(tenantId);

    if (tenantId) {
      return raw.replace(
        `tenant:${tenantId}:`,
        `tenant:${tenantId}:v${version}:`,
      );
    }
    return `v${version}:${raw}`;
  }

  async getOrSetCache<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlSeconds = 3600,
  ): Promise<T> {
    const cacheKey = await this.resolveKey(key);
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData) as T;

    const freshData = await fetchFunction();
    if (freshData !== null && freshData !== undefined) {
      await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(freshData));
    }
    return freshData;
  }

  async clearCacheForSetor(
    _id: string | null | undefined,
    tenantId: string | null = null,
  ) {
    // Versioned keys are invalidated via bumpVersion; also bump the global
    // counter so unscoped reads (tenantId=null) cannot serve a stale tree.
    await this.bumpVersion(tenantId);
    if (tenantId) {
      await this.bumpVersion(null);
    }
  }

  async clearCacheForFuncionarios(
    tenantId: string | null = null,
    ..._keys: unknown[]
  ) {
    await this.bumpVersion(tenantId);
    if (tenantId) {
      await this.bumpVersion(null);
    }
  }

  async clearCacheForDivisoes(
    tenantId: string | null = null,
    ..._ids: unknown[]
  ) {
    await this.bumpVersion(tenantId);
  }

  async clearCacheForCoordChange(
    tenantId: string | null | undefined,
    _oldCoordIds?: unknown,
    _newCoordId?: unknown,
    _parentIds: unknown[] = [],
  ) {
    await this.bumpVersion(tenantId ?? null);
  }
}
