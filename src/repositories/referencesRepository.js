const Reference = require('../models/referenciasSchema');
const redis = require('../config/redisClient');

class ReferencesRepository {
  static async findReferenceByName(name) {
    return await Reference.findOne({ name });
  }

  static async findReferenceByFuncionarioId(funcionarioId) {
    return await Reference.findOne({ funcionarioId });
  }

  static async createReference(referenceData) {
    const newReference = new Reference(referenceData);
    return await newReference.save();
  }

  static async getAllReferences() {
    return await Reference.find().sort({ name: 1 });
  }

  static async deleteReferenceById(id) {
    return await Reference.findByIdAndDelete(id);
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