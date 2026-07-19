#!/usr/bin/env node
/**
 * Seeds the platform superadmin (master console).
 * Usage: npm run seed:superadmin
 *
 * Default credentials (override with env):
 *   SUPERADMIN_ID=superadmin
 *   SUPERADMIN_USERNAME=superadmin
 *   SUPERADMIN_PASSWORD=senha123
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const User = require('../models/usuariosSchema');

const ID = process.env.SUPERADMIN_ID || 'superadmin';
const USERNAME = process.env.SUPERADMIN_USERNAME || 'superadmin';
const PASSWORD = process.env.SUPERADMIN_PASSWORD || 'senha123';

async function seed() {
  console.log('Provisioning platform superadmin...');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  let user = await User.findOne({
    $or: [{ id: ID }, { username: USERNAME, tenantId: null }],
  });

  if (user) {
    user.id = ID;
    user.username = USERNAME;
    user.passwordHash = passwordHash;
    user.role = 'superadmin';
    user.tenantId = null;
    await user.save();
    console.log('Superadmin atualizado:', user._id.toString());
  } else {
    user = await User.create({
      id: ID,
      username: USERNAME,
      passwordHash,
      role: 'superadmin',
      tenantId: null,
    });
    console.log('Superadmin criado:', user._id.toString());
  }

  console.log('');
  console.log('Credenciais do console master:');
  console.log(`  URL:  http://master.localhost:5173`);
  console.log(`  ID:   ${ID}`);
  console.log(`  Senha: ${PASSWORD}`);
  console.log('');
  console.log('Este usuário NÃO pertence a um tenant municipal (tenantId = null).');

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
