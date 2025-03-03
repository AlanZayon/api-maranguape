const {
  connectFuncDB,
  disconnectFuncDB,
} = require('../src/config/Mongoose/funcionariosConnection');
const {
  connectUserDB,
  disconnectUserDB,
} = require('../src/config/Mongoose/usuariosConnection');
const { MongoMemoryServer } = require('mongodb-memory-server');
const redisClient = require('../src/config/redisClient');
const { beforeAll, afterAll } = require('@jest/globals');

let mongoServerFunc;
let mongoServerUser;

beforeAll(async () => {
  // Conectar ao MongoDB de Funcionários
  mongoServerFunc = await MongoMemoryServer.create();
  const mongoURIFunc = mongoServerFunc.getUri();
  await connectFuncDB(
    process.env.MONGO_CONNECTING_FUNCIONARIOS || mongoURIFunc
  );

  // Conectar ao MongoDB de Usuários
  mongoServerUser = await MongoMemoryServer.create();
  const mongoURIUser = mongoServerUser.getUri();
  await connectUserDB(process.env.MONGO_CONNECTING_USUARIOS || mongoURIUser);
});

afterAll(async () => {
  // Fechar a conexão com o MongoDB de Funcionários
  await disconnectFuncDB();

  // Fechar a conexão com o MongoDB de Usuários
  await disconnectUserDB();

  await redisClient.quit();
});
