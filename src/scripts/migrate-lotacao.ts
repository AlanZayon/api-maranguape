import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Setor } from '../modules/setores/schemas/setor.schema';
import { Funcionario } from '../modules/funcionarios/schemas/funcionario.schema';

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const setorModel = app.get<Model<Setor>>(getModelToken(Setor.name));
  const funcionarioModel = app.get<Model<Funcionario>>(
    getModelToken(Funcionario.name),
  );

  console.log('Iniciando migração Coordenadoria → Subsetor / setorId...');

  const coordCount = await setorModel.collection.countDocuments({
    tipo: 'Coordenadoria',
  });
  console.log(`[setors] Coordenadoria encontradas: ${coordCount}`);

  if (coordCount > 0) {
    const result = await setorModel.collection.updateMany(
      { tipo: 'Coordenadoria' },
      { $set: { tipo: 'Subsetor' } },
    );
    console.log(
      `[setors] convertidos: matched=${result.matchedCount} modified=${result.modifiedCount}`,
    );
  }

  const renameResult = await funcionarioModel.collection.updateMany(
    { coordenadoria: { $exists: true }, setorId: { $exists: false } },
    { $rename: { coordenadoria: 'setorId' } },
  );
  console.log(
    `[funcionarios] $rename coordenadoria→setorId: matched=${renameResult.matchedCount} modified=${renameResult.modifiedCount}`,
  );

  const dropDup = await funcionarioModel.collection.updateMany(
    { coordenadoria: { $exists: true }, setorId: { $exists: true } },
    { $unset: { coordenadoria: '' } },
  );
  console.log(
    `[funcionarios] unset coordenadoria duplicado: modified=${dropDup.modifiedCount}`,
  );

  await app.close();
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
