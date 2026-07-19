/* eslint-disable no-undef */
const { describe, test, expect, beforeEach } = require('@jest/globals');

jest.mock('../../../src/config/redisClient', () => ({
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  incr: jest.fn(),
  scan: jest.fn(),
  keys: jest.fn(),
  pipeline: jest.fn(() => ({
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  })),
}));

const redisClient = require('../../../src/config/redisClient');
const CacheService = require('../../../src/services/CacheService');

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisClient.get.mockResolvedValue(null);
    redisClient.incr.mockResolvedValue(1);
    redisClient.del.mockResolvedValue(1);
  });

  describe('getOrSetCache', () => {
    test('returns cached JSON when present', async () => {
      redisClient.get
        .mockResolvedValueOnce('0') // version
        .mockResolvedValueOnce(JSON.stringify({ a: 1 })); // data

      const fetchFn = jest.fn();
      const result = await CacheService.getOrSetCache('k', fetchFn);

      expect(result).toEqual({ a: 1 });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(redisClient.setex).not.toHaveBeenCalled();
    });

    test('caches empty array from fetchFunction under versioned key', async () => {
      redisClient.get
        .mockResolvedValueOnce('3') // version
        .mockResolvedValueOnce(null); // miss
      redisClient.setex.mockResolvedValue('OK');

      const result = await CacheService.getOrSetCache('k', async () => []);

      expect(result).toEqual([]);
      expect(redisClient.setex).toHaveBeenCalledWith(
        'v3:k',
        3600,
        JSON.stringify([])
      );
    });

    test('versions tenant-prefixed keys', async () => {
      redisClient.get
        .mockResolvedValueOnce('2')
        .mockResolvedValueOnce(null);
      redisClient.setex.mockResolvedValue('OK');

      const data = { subsetores: [] };
      const result = await CacheService.getOrSetCache(
        'tenant:abc:setoresOrganizados',
        async () => data
      );

      expect(result).toEqual(data);
      expect(redisClient.setex).toHaveBeenCalledWith(
        'tenant:abc:v2:setoresOrganizados',
        3600,
        JSON.stringify(data)
      );
    });

    test('does not cache null', async () => {
      redisClient.get
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce(null);

      const result = await CacheService.getOrSetCache('k', async () => null);

      expect(result).toBeNull();
      expect(redisClient.setex).not.toHaveBeenCalled();
    });
  });

  describe('clearCacheForSetor', () => {
    test('deletes known keys and bumps tenant version (no SCAN)', async () => {
      await CacheService.clearCacheForSetor('abc', 'tenant1');

      expect(redisClient.del).toHaveBeenCalledWith('setor:abc:dados');
      expect(redisClient.del).toHaveBeenCalledWith('setores:null');
      expect(redisClient.del).toHaveBeenCalledWith('setoresOrganizados');
      expect(redisClient.incr).toHaveBeenCalledWith('tenant:tenant1:cache:v');
      expect(redisClient.scan).not.toHaveBeenCalled();
    });
  });

  describe('clearCacheForFuncionarios', () => {
    test('bumps version without scanning', async () => {
      await CacheService.clearCacheForFuncionarios('t1', 'setor1');

      expect(redisClient.incr).toHaveBeenCalledWith('tenant:t1:cache:v');
      expect(redisClient.scan).not.toHaveBeenCalled();
    });
  });
});
