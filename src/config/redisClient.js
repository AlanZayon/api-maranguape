const Redis = require('ioredis');

// Conectando ao Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  family: 4,
});
// const redis = new Redis(process.env.REDIS_URL + '?family=0');


redis.on('connect', () => {
    console.log('Conectado ao Redis!');
  });
  
  redis.on('error', (err) => {
    console.error('Erro de conexão no Redis:', err);
  });

module.exports = redis;
