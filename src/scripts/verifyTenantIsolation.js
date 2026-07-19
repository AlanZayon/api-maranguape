/**
 * Verifies tenant isolation after migrate:tenant.
 * Reports documents missing tenantId (except superadmin users).
 *
 * Usage: node src/scripts/verifyTenantIsolation.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function countMissing(Model, extraFilter = {}) {
  return Model.countDocuments({
    $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
    ...extraFilter,
  });
}

async function main() {
  const uri =
    process.env.MONGO_CONNECTING_FUNCIONARIOS ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI;

  if (!uri) {
    console.error('Missing MONGO_CONNECTING_FUNCIONARIOS');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const Funcionario = require('../models/funcionariosSchema');
  const Setor = require('../models/setoresSchema');
  const Reference = require('../models/referenciasSchema');
  const Cargo = require('../models/CargoComissionadoSchema');
  const Simbologia = require('../models/limitesSimbologiaSchema');
  const User = require('../models/usuariosSchema');

  const report = {
    funcionarios: await countMissing(Funcionario),
    setores: await countMissing(Setor),
    referencias: await countMissing(Reference),
    cargos: await countMissing(Cargo),
    simbologias: await countMissing(Simbologia),
    usersNonSuperadmin: await countMissing(User, {
      role: { $ne: 'superadmin' },
    }),
  };

  console.log('Documents missing tenantId:');
  console.table(report);

  const total = Object.values(report).reduce((a, b) => a + b, 0);
  if (total > 0) {
    console.error(
      `\nFAIL: ${total} document(s) still lack tenantId. Run migrate:tenant.`
    );
    process.exitCode = 1;
  } else {
    console.log('\nOK: tenant isolation backfill looks complete.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
