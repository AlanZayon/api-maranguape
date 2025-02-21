const dotenv = require('dotenv');
const mongooseUsuarios = require('mongoose');
dotenv.config();

const db = mongooseUsuarios.createConnection(
  process.env.MONGO_CONNECTING_USUARIOS
);

db.on('error', console.error.bind(console, 'Erro na conexão com MongoDB:'));
db.once('open', () => {
  console.log('Conectado ao MongoDB');
});
module.exports = db;
