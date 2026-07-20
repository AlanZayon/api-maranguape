import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Tenant } from '../modules/tenants/schemas/tenant.schema';
import { Funcionario } from '../modules/funcionarios/schemas/funcionario.schema';
import { Setor } from '../modules/setores/schemas/setor.schema';
import { Reference } from '../modules/referencias/schemas/referencia.schema';
import { User } from '../modules/auth/schemas/user.schema';
import {
  CARGO_MODEL,
  SIMBOLOGIA_MODEL,
} from '../database/database.module';

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const tenantModel = app.get<Model<Tenant>>(getModelToken(Tenant.name));
  const funcionarioModel = app.get<Model<Funcionario>>(
    getModelToken(Funcionario.name),
  );
  const setorModel = app.get<Model<Setor>>(getModelToken(Setor.name));
  const referenciaModel = app.get<Model<Reference>>(
    getModelToken(Reference.name),
  );
  const cargoModel = app.get<Model<unknown>>(getModelToken(CARGO_MODEL));
  const simbologiaModel = app.get<Model<unknown>>(
    getModelToken(SIMBOLOGIA_MODEL),
  );
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  console.log('Iniciando migração de tenant...');

  let tenant = await tenantModel.findOne({ slug: 'maranguape' });
  if (!tenant) {
    tenant = await tenantModel.create({
      slug: 'maranguape',
      name: 'Maranguape',
      branding: {
        logoUrl: null,
        primaryColor: '#1a5f2a',
        displayName: 'Prefeitura de Maranguape',
      },
      settings: { vocabulary: {}, seedOnCreate: true },
      status: 'active',
    });
    console.log('Tenant Maranguape criado:', String(tenant._id));
  } else {
    console.log('Tenant Maranguape já existe:', String(tenant._id));
  }

  const tenantId = tenant._id;
  const filterMissing = {
    $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
  };

  const updates = await Promise.all([
    funcionarioModel.updateMany(filterMissing, { $set: { tenantId } }),
    setorModel.updateMany(filterMissing, { $set: { tenantId } }),
    referenciaModel.updateMany(filterMissing, { $set: { tenantId } }),
    cargoModel.updateMany(filterMissing, { $set: { tenantId } }),
    simbologiaModel.updateMany(filterMissing, { $set: { tenantId } }),
    userModel.updateMany(
      {
        ...filterMissing,
        role: { $ne: 'superadmin' },
      },
      { $set: { tenantId } },
    ),
  ]);

  console.log('Backfill tenantId:', {
    funcionarios: updates[0].modifiedCount,
    setores: updates[1].modifiedCount,
    referencias: updates[2].modifiedCount,
    cargos: updates[3].modifiedCount,
    simbologias: updates[4].modifiedCount,
    users: updates[5].modifiedCount,
  });

  await app.close();
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
