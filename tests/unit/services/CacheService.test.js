/**
 * Smoke tests for Nest CacheService (ported from legacy CacheService tests).
 */
const { CacheService } = require('../../../src/infrastructure/cache/cache.service');

describe('CacheService', () => {
  const store = new Map();
  const redis = {
    get: jest.fn(async (k) => store.get(k) || null),
    setex: jest.fn(async (k, _ttl, v) => {
      store.set(k, v);
      return 'OK';
    }),
    incr: jest.fn(async (k) => {
      const n = Number(store.get(k) || 0) + 1;
      store.set(k, String(n));
      return n;
    }),
    del: jest.fn(async (...keys) => {
      let n = 0;
      for (const k of keys) {
        if (store.delete(k)) n += 1;
      }
      return n;
    }),
  };

  /** @type {CacheService} */
  let cache;

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
    cache = new CacheService(redis);
  });

  test('tenantKey prefixes with tenant', () => {
    expect(cache.tenantKey('abc', 'foo')).toBe('tenant:abc:foo');
    expect(cache.tenantKey(null, 'foo')).toBe('foo');
  });

  test('getOrSetCache stores and returns fresh data', async () => {
    const fetch = jest.fn(async () => ({ ok: true }));
    const first = await cache.getOrSetCache('tenant:t1:list', fetch, 60);
    expect(first).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);

    const second = await cache.getOrSetCache('tenant:t1:list', fetch, 60);
    expect(second).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('bumpVersion invalidates logical keys', async () => {
    const fetch = jest.fn(async () => ({ v: 1 }));
    await cache.getOrSetCache('tenant:t1:list', fetch, 60);
    await cache.bumpVersion('t1');
    fetch.mockResolvedValueOnce({ v: 2 });
    const next = await cache.getOrSetCache('tenant:t1:list', fetch, 60);
    expect(next).toEqual({ v: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
