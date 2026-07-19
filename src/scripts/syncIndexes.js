/**
 * Syncs Mongoose indexes for Funcionario and Setor models.
 * Called on server boot (non-blocking) or via: node src/scripts/syncIndexes.js
 */
require('dotenv').config();

const connectToFuncionariosDB = require('../config/Mongoose/funcionariosConnection');
const Funcionario = require('../models/funcionariosSchema');
const Setor = require('../models/setoresSchema');

async function syncIndexes() {
  connectToFuncionariosDB();
  await Promise.all([Funcionario.syncIndexes(), Setor.syncIndexes()]);
  console.log('Índices sincronizados (Funcionario, Setor)');
}

if (require.main === module) {
  syncIndexes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Falha ao sincronizar índices:', err);
      process.exit(1);
    });
}

module.exports = { syncIndexes };
