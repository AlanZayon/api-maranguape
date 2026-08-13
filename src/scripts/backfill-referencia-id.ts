import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Funcionario } from '../modules/funcionarios/schemas/funcionario.schema';
import { Reference } from '../modules/referencias/schemas/referencia.schema';

/**
 * Preenche `funcionario.referenciaId` a partir do nome guardado em
 * `funcionario.referencia`, agrupando por tenant (o nome só é único por tenant).
 */
async function backfill() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const funcionarioModel = app.get<Model<Funcionario>>(
    getModelToken(Funcionario.name),
  );
  const referenceModel = app.get<Model<Reference>>(getModelToken(Reference.name));

  const references = await referenceModel
    .find({}, { name: 1, tenantId: 1 })
    .lean();

  const byTenantAndName = new Map<string, unknown>();
  for (const reference of references) {
    const key = `${String(reference.tenantId ?? '')}::${String(reference.name || '')
      .trim()
      .toUpperCase()}`;
    byTenantAndName.set(key, reference._id);
  }

  const funcionarios = await funcionarioModel
    .find(
      {
        referencia: { $nin: [null, ''] },
        $or: [{ referenciaId: null }, { referenciaId: { $exists: false } }],
      },
      { referencia: 1, tenantId: 1 },
    )
    .lean();

  let matched = 0;
  let unmatched = 0;
  const operations: Parameters<Model<Funcionario>['bulkWrite']>[0] = [];

  for (const funcionario of funcionarios) {
    const key = `${String(funcionario.tenantId ?? '')}::${String(
      funcionario.referencia || '',
    )
      .trim()
      .toUpperCase()}`;
    const referenciaId = byTenantAndName.get(key);

    if (!referenciaId) {
      unmatched += 1;
      continue;
    }

    matched += 1;
    operations.push({
      updateOne: {
        filter: { _id: funcionario._id },
        update: { $set: { referenciaId } },
      },
    });
  }

  if (operations.length) {
    await funcionarioModel.bulkWrite(operations);
  }

  // Referências criadas antes da hierarquia não têm o campo; sem ele elas não
  // aparecem como raiz nas consultas por `parentId: null`.
  const rootsFixed = await referenceModel.updateMany(
    { parentId: { $exists: false } },
    { $set: { parentId: null } },
  );

  console.log('Backfill de referenciaId concluído:', {
    funcionariosVinculados: matched,
    funcionariosSemReferenciaCorrespondente: unmatched,
    referenciasNormalizadasComoRaiz: rootsFixed.modifiedCount,
  });

  await app.close();
  process.exit(0);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
