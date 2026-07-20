require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const { beforeAll, afterAll } = require('@jest/globals');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_CONNECTING_FUNCIONARIOS = mongoServer.getUri();
  process.env.MONGO_CONNECTING_USUARIOS = process.env.MONGO_CONNECTING_FUNCIONARIOS;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  process.env.NEST_HOST = 'true';
  process.env.NEST_MIGRATED = 'all';
  process.env.BULK_WORKER_EMBEDDED = 'false';
}, 120000);

afterAll(async () => {
  if (mongoServer) {
    await mongoServer.stop();
  }
});
