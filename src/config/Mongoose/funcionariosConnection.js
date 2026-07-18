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
  funcionariosConnection = mongoose.createConnection(uri);

  funcionariosConnection.on(
    'error',
    console.error.bind(console, 'Erro na conexão com MongoDB:')
  );
  funcionariosConnection.once('open', () => {
    console.log('Conectado ao MongoDB (funcionarios)');
  });

  return funcionariosConnection;
}

module.exports = connectToFuncionariosDB;
