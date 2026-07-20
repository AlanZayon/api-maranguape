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

async function countMissing(
  model: Model<unknown>,
  extraFilter: Record<string, unknown> = {},
) {
  return model.countDocuments({
    $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
    ...extraFilter,
  });
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const report = {
    funcionarios: await countMissing(
      app.get(getModelToken(Funcionario.name)),
    ),
    setores: await countMissing(app.get(getModelToken(Setor.name))),
    referencias: await countMissing(app.get(getModelToken(Reference.name))),
    cargos: await countMissing(app.get(getModelToken(CARGO_MODEL))),
    simbologias: await countMissing(app.get(getModelToken(SIMBOLOGIA_MODEL))),
    usersNonSuperadmin: await countMissing(app.get(getModelToken(User.name)), {
      role: { $ne: 'superadmin' },
    }),
    tenants: await app
      .get<Model<Tenant>>(getModelToken(Tenant.name))
      .countDocuments(),
  };

  console.log('Documents missing tenantId:');
  console.table(report);

  const leaking = Object.entries(report)
    .filter(([k, v]) => k !== 'tenants' && Number(v) > 0)
    .map(([k, v]) => `${k}=${v}`);

  await app.close();

  if (leaking.length) {
    console.error('FAIL: isolation gaps:', leaking.join(', '));
    process.exit(1);
  }
  console.log('OK: tenant isolation looks good.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
