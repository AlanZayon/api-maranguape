/* eslint-disable no-undef */
const { describe, test, expect, beforeEach } = require('@jest/globals');

jest.mock('../../../src/config/redisClient', () => ({
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
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
  });

  describe('getOrSetCache', () => {
    test('returns cached JSON when present', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify({ a: 1 }));

      const fetchFn = jest.fn();
      const result = await CacheService.getOrSetCache('k', fetchFn);

      expect(result).toEqual({ a: 1 });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(redisClient.setex).not.toHaveBeenCalled();
    });

    test('caches empty array from fetchFunction', async () => {
      redisClient.get.mockResolvedValue(null);
      redisClient.setex.mockResolvedValue('OK');

      const result = await CacheService.getOrSetCache('k', async () => []);

      expect(result).toEqual([]);
      expect(redisClient.setex).toHaveBeenCalledWith(
        'k',
        3600,
        JSON.stringify([])
      );
    });

    test('caches object without funcionarios', async () => {
      redisClient.get.mockResolvedValue(null);
      redisClient.setex.mockResolvedValue('OK');

      const data = { subsetores: [] };
      const result = await CacheService.getOrSetCache('k', async () => data);

      expect(result).toEqual(data);
      expect(redisClient.setex).toHaveBeenCalled();
    });

    test('does not cache null', async () => {
      redisClient.get.mockResolvedValue(null);

      const result = await CacheService.getOrSetCache('k', async () => null);

      expect(result).toBeNull();
      expect(redisClient.setex).not.toHaveBeenCalled();
    });
  });

  describe('scanKeys / deleteByPattern', () => {
    test('uses SCAN instead of KEYS', async () => {
      redisClient.scan
        .mockResolvedValueOnce(['10', ['a:1', 'a:2']])
        .mockResolvedValueOnce(['0', []]);

      const keys = await CacheService.scanKeys('a:*');

      expect(redisClient.scan).toHaveBeenCalled();
      expect(redisClient.keys).not.toHaveBeenCalled();
      expect(keys).toEqual(['a:1', 'a:2']);
    });
  });

  describe('clearCacheForSetor', () => {
    test('deletes setor key when it exists', async () => {
      redisClient.exists.mockResolvedValue(1);
      redisClient.del.mockResolvedValue(1);
      // tenant:* pattern clears via SCAN
      redisClient.scan.mockResolvedValue(['0', []]);

      await CacheService.clearCacheForSetor('abc');

      expect(redisClient.del).toHaveBeenCalledWith('setor:abc:dados');
      expect(redisClient.del).toHaveBeenCalledWith('setores:null');
      expect(redisClient.del).toHaveBeenCalledWith('setoresOrganizados');
      expect(redisClient.scan).toHaveBeenCalled();
    });
  });
});
