#!/usr/bin/env node
/**
 * Migration: Coordenadoria → Subsetor; funcionarios.coordenadoria → setorId.
 * Usage: node src/scripts/migrateCoordenadoriaToSubsetor.js
 *        npm run migrate:lotacao
 *
 * Run BEFORE deploying code that removes Coordenadoria from the Setor enum.
 */
require('dotenv').config();

const Setor = require('../models/setoresSchema');
const Funcionario = require('../models/funcionariosSchema');

async function migrate() {
  console.log('Iniciando migração Coordenadoria → Subsetor / setorId...');

  const coordCount = await Setor.collection.countDocuments({
    tipo: 'Coordenadoria',
  });
  console.log(`[setors] Coordenadoria encontradas: ${coordCount}`);

  const withOldFk = await Funcionario.collection.countDocuments({
    coordenadoria: { $exists: true },
  });
  const withNewFk = await Funcionario.collection.countDocuments({
    setorId: { $exists: true },
  });
  console.log(
    `[funcionarios] com coordenadoria=${withOldFk}, com setorId=${withNewFk}`
  );

  if (coordCount > 0) {
    const result = await Setor.collection.updateMany(
      { tipo: 'Coordenadoria' },
      { $set: { tipo: 'Subsetor' } }
    );
    console.log(
      `[setors] convertidos: matched=${result.matchedCount} modified=${result.modifiedCount}`
    );
  }

  // Rename FK when old field still present
  const renameResult = await Funcionario.collection.updateMany(
    { coordenadoria: { $exists: true }, setorId: { $exists: false } },
    { $rename: { coordenadoria: 'setorId' } }
  );
  console.log(
    `[funcionarios] $rename coordenadoria→setorId: matched=${renameResult.matchedCount} modified=${renameResult.modifiedCount}`
  );

  // If both fields somehow exist, prefer setorId and drop coordenadoria
  const dropDup = await Funcionario.collection.updateMany(
    { coordenadoria: { $exists: true }, setorId: { $exists: true } },
    { $unset: { coordenadoria: '' } }
  );
  console.log(
    `[funcionarios] unset coordenadoria duplicado: modified=${dropDup.modifiedCount}`
  );

  const remainingCoord = await Setor.collection.countDocuments({
    tipo: 'Coordenadoria',
  });
  const remainingOldFk = await Funcionario.collection.countDocuments({
    coordenadoria: { $exists: true },
  });
  const finalSetorId = await Funcionario.collection.countDocuments({
    setorId: { $exists: true },
  });

  console.log('--- Resumo ---');
  console.log(`Coordenadoria restantes: ${remainingCoord}`);
  console.log(`funcionarios.coordenadoria restantes: ${remainingOldFk}`);
  console.log(`funcionarios.setorId: ${finalSetorId}`);
  console.log('Migração concluída.');
  console.log('Flush Redis caches manualmente se necessário (setoresOrganizados, setor:*, etc.).');
}

migrate()
  .then(async () => {
    await Promise.allSettled([
      Funcionario.db?.close?.(),
      Setor.db?.close?.(),
    ]);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migração falhou:', err);
    process.exit(1);
  });
