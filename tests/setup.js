const connectToFuncionariosDB = require('../src/config/Mongoose/funcionariosConnection');
const { MongoMemoryServer } = require('mongodb-memory-server');
const redisClient = require('../src/config/redisClient');
const { beforeAll, afterAll } = require('@jest/globals');
require('dotenv').config();

let mongoServerFunc;

beforeAll(async () => {
  // Conectar ao MongoDB de Funcionários
  mongoServerFunc = await MongoMemoryServer.create();
  const mongoURIFunc = mongoServerFunc.getUri();
  await connectToFuncionariosDB(
    process.env.MONGO_CONNECTING_FUNCIONARIOS || mongoURIFunc
  );
});

afterAll(async () => {
  await redisClient.quit();
});
