const Redis = require('ioredis');

// Conectando ao Redis
const redis = new Redis( "redis://default:BMbPPgtSoyimvQxxxOwfqBRBBPmeVcVV@autorack.proxy.rlwy.net:10989");


redis.on('connect', () => {
    console.log('Conectado ao Redis!');
  });
  
  redis.on('error', (err) => {
    console.error('Erro de conexão no Redis:', err);
  });

module.exports = redis;
