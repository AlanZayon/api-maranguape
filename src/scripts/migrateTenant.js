#!/usr/bin/env node
/**
 * Migration: create tenant Maranguape and backfill tenantId on existing documents.
 * Usage: node src/scripts/migrateTenant.js
 *        npm run migrate:tenant
 */
require('dotenv').config();

const Tenant = require('../models/tenantSchema');
const Funcionario = require('../models/funcionariosSchema');
const Setor = require('../models/setoresSchema');
const Referencia = require('../models/referenciasSchema');
const CargoComissionado = require('../models/CargoComissionadoSchema');
const Simbologia = require('../models/limitesSimbologiaSchema');
const User = require('../models/usuariosSchema');

async function migrate() {
  console.log('Iniciando migração de tenant...');

  let tenant = await Tenant.findOne({ slug: 'maranguape' });
  if (!tenant) {
    tenant = await Tenant.create({
      slug: 'maranguape',
      name: 'Maranguape',
      branding: {
        logoUrl: null,
        primaryColor: '#1a5f2a',
        displayName: 'Prefeitura de Maranguape',
      },
      settings: { vocabulary: {} },
      status: 'active',
    });
    console.log('Tenant Maranguape criado:', tenant._id.toString());
  } else {
    console.log('Tenant Maranguape já existe:', tenant._id.toString());
  }

  const tenantId = tenant._id;
  const filterMissing = {
    $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
  };

  const collections = [
    { name: 'funcionarios', model: Funcionario },
    { name: 'setors', model: Setor },
    { name: 'references', model: Referencia },
    { name: 'cargocomissionados', model: CargoComissionado },
    { name: 'simbologias', model: Simbologia },
  ];

  for (const { name, model } of collections) {
    const result = await model.updateMany(filterMissing, {
      $set: { tenantId },
    });
    console.log(
      `[${name}] matched=${result.matchedCount} modified=${result.modifiedCount}`
    );
  }

  const usersResult = await User.updateMany(
    {
      ...filterMissing,
      role: { $ne: 'superadmin' },
    },
    { $set: { tenantId } }
  );
  console.log(
    `[users] matched=${usersResult.matchedCount} modified=${usersResult.modifiedCount}`
  );

  console.log('Migração concluída.');
}

migrate()
  .then(async () => {
    console.log('Encerrando conexões...');
    const Funcionario = require('../models/funcionariosSchema');
    const User = require('../models/usuariosSchema');
    await Promise.allSettled([
      Funcionario.db?.close?.(),
      User.db?.close?.(),
    ]);
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Erro na migração:', err);
    process.exit(1);
  });
