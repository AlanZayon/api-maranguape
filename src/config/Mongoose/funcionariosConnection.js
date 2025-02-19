const dotenv = require('dotenv');
const mongoose = require("mongoose");
const { MongoMemoryServer } = require('mongodb-memory-server');

dotenv.config();

const connectDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    // Se for um ambiente de teste, use MongoDB Memory Server
    global.mongoServer = await MongoMemoryServer.create();
    const uri = global.mongoServer.getUri();
    return mongoose.createConnection(uri);
  } else {
    // Se não for teste, usa a conexão normal
    return mongoose.createConnection(process.env.MONGO_CONNECTING_FUNCIONARIOS);
  }
};

const dbPromise = connectDB(); // Cria a conexão com o banco

module.exports = dbPromise;
