const mongoose = require('mongoose');

let funcionariosConnection = null;

/**
 * Shared Mongo connection for main domain data (singleton).
 */
function connectToFuncionariosDB(mongoUri) {
  if (funcionariosConnection) {
    return funcionariosConnection;
  }

  const uri = mongoUri || process.env.MONGO_CONNECTING_FUNCIONARIOS;
  // Docker Desktop / cold start can take >5s for first server selection
  funcionariosConnection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 30000,
    maxPoolSize: 10,
  });

  funcionariosConnection.on(
    'error',
    console.error.bind(console, 'Erro na conexão com MongoDB:')
  );
  funcionariosConnection.on('disconnected', () => {
    console.warn('MongoDB (funcionarios) desconectado — aguardando reconexão...');
  });
  funcionariosConnection.on('reconnected', () => {
    console.log('MongoDB (funcionarios) reconectado');
  });
  funcionariosConnection.once('open', () => {
    console.log('Conectado ao MongoDB (funcionarios)');
  });

  return funcionariosConnection;
}

module.exports = connectToFuncionariosDB;
