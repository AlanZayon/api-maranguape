const Redis = require('ioredis');

// Conectando ao Redis
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost', // Usa variável de ambiente ou localhost
    port: process.env.REDIS_PORT || 6379, // Porta padrão do Redis
    db: 0, // Banco de dados Redis (padrão: 0)
});

module.exports = redis;
