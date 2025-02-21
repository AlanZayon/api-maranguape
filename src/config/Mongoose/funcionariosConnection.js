const dotenv = require('dotenv');
const mongooseFuncionarios = require('mongoose');
dotenv.config();

const db = mongooseFuncionarios.createConnection(
  process.env.MONGO_CONNECTING_FUNCIONARIOS
);

db.on('error', console.error.bind(console, 'Erro na conexão com MongoDB:'));
db.once('open', () => {
  console.log('Conectado ao MongoDB');
});
module.exports = db;
