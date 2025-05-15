// db/funcionarios.js
const mongoose = require('mongoose');

function connectToFuncionariosDB(mongoUri) {
  const db = mongoose.createConnection(
    mongoUri || process.env.MONGO_CONNECTING_FUNCIONARIOS
  );

  db.on('error', console.error.bind(console, 'Erro na conexão com MongoDB:'));
  db.once('open', () => {
    console.log('Conectado ao MongoDB');
  });

  return db;
}

module.exports = connectToFuncionariosDB;
