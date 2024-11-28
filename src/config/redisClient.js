const Redis = require('ioredis');

// Conectando ao Redis
const redis = new Redis(process.env.REDIS_URL);

module.exports = redis;
