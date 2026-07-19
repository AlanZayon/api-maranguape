const Reference = require('../models/referenciasSchema');
const redis = require('../config/redisClient');
const { tenantFilter, cacheKey } = require('../utils/tenantHelpers');

class ReferencesRepository {
  static cacheKeyFor(tenantId) {
    return cacheKey(tenantId, 'referencias-dados');
  }

  static async findReferenceByName(name, tenantId = null) {
    return await Reference.findOne({ name, ...tenantFilter(tenantId) });
  }

  static async findReferenceByFuncionarioId(funcionarioId, tenantId = null) {
    return await Reference.findOne({
      funcionarioId,
      ...tenantFilter(tenantId),
    });
  }

  static async createReference(referenceData) {
    const newReference = new Reference(referenceData);
    return await newReference.save();
  }

  static async getAllReferences(tenantId = null) {
    return await Reference.find(tenantFilter(tenantId)).sort({ name: 1 });
  }

  static async deleteReferenceById(id, tenantId = null) {
    return await Reference.findOneAndDelete({
      _id: id,
      ...tenantFilter(tenantId),
    });
  }

  static async getRedisCache(key) {
    const cacheData = await redis.get(key);
    return cacheData ? JSON.parse(cacheData) : null;
  }

  static async setRedisCache(key, data, ttl = 3600) {
    await redis.setex(key, ttl, JSON.stringify(data));
  }
}

module.exports = ReferencesRepository;
