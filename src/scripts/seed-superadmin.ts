import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { User } from '../modules/auth/schemas/user.schema';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const ID = process.env.SUPERADMIN_ID || 'superadmin';
  const USERNAME = process.env.SUPERADMIN_USERNAME || 'superadmin';
  const PASSWORD = process.env.SUPERADMIN_PASSWORD || 'senha123';

  console.log('Provisioning platform superadmin...');
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  let user = await userModel.findOne({
    $or: [{ id: ID }, { username: USERNAME, tenantId: null }],
  });

  if (user) {
    user.id = ID;
    user.username = USERNAME;
    user.passwordHash = passwordHash;
    user.role = 'superadmin';
    user.tenantId = null;
    await user.save();
    console.log('Superadmin atualizado:', String(user._id));
  } else {
    user = await userModel.create({
      id: ID,
      username: USERNAME,
      passwordHash,
      role: 'superadmin',
      tenantId: null,
    });
    console.log('Superadmin criado:', String(user._id));
  }

  console.log('');
  console.log('Credenciais do console master:');
  console.log(`  URL:  http://master.localhost:5173`);
  console.log(`  ID:   ${ID}`);
  console.log(`  Senha: ${PASSWORD}`);

  await app.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
