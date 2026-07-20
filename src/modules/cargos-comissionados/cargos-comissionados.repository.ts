import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CargoComissionado } from './schemas/cargo-comissionado.schema';
import { LimiteSimbologia } from '../funcionarios/schemas/limite-simbologia.schema';
import { CARGO_MODEL, SIMBOLOGIA_MODEL } from '../../database/database.module';
import { tenantFilter, toObjectId, idMatchValues } from '../../common/utils/tenant.helpers';

export type UpsertSimbologiaInput = {
  simbologia: string;
  limite?: number | null;
  tenantId?: string | null;
  userId?: string | null;
};

@Injectable()
export class CargosComissionadosRepository {
  constructor(
    @InjectModel(CARGO_MODEL)
    private readonly cargoModel: Model<CargoComissionado>,
    @InjectModel(SIMBOLOGIA_MODEL)
    private readonly simbologiaModel: Model<LimiteSimbologia>,
  ) {}

  async buscarTodos(tenantId: string | null = null) {
    const match = tenantFilter(tenantId);
    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(match).length) {
      pipeline.push({ $match: match });
    }
    const tenantValues = idMatchValues(tenantId);
    const lookupMatch = tenantValues.length
      ? {
          $expr: {
            $and: [
              { $eq: ['$simbologia', '$$simb'] },
              { $in: ['$tenantId', tenantValues] },
            ],
          },
        }
      : { $expr: { $eq: ['$simbologia', '$$simb'] } };
    pipeline.push(
      {
        $lookup: {
          from: 'simbologias',
          let: { simb: '$simbologia' },
          pipeline: [{ $match: lookupMatch }],
          as: 'simbologiaInfo',
        },
      },
      {
        $unwind: {
          path: '$simbologiaInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { cargo: 1 } },
    );
    return this.cargoModel.aggregate(pipeline as any);
  }

  async buscarPorId(id: string, tenantId: string | null = null) {
    return this.cargoModel.findOne({ _id: id, ...tenantFilter(tenantId) });
  }

  async buscarPorNome(nome: string, tenantId: string | null = null) {
    return this.cargoModel.findOne({ cargo: nome, ...tenantFilter(tenantId) });
  }

  async criar(data: Partial<CargoComissionado>) {
    return this.cargoModel.create(data);
  }

  async atualizar(
    id: string,
    data: Partial<CargoComissionado>,
    tenantId: string | null = null,
  ) {
    return this.cargoModel.findOneAndUpdate(
      { _id: id, ...tenantFilter(tenantId) },
      data,
      { new: true, runValidators: true },
    );
  }

  async remover(id: string, tenantId: string | null = null) {
    return this.cargoModel.findOneAndDelete({
      _id: id,
      ...tenantFilter(tenantId),
    });
  }

  async buscarPorSimbologia(simbologia: string, tenantId: string | null = null) {
    return this.simbologiaModel.findOne({
      simbologia,
      ...tenantFilter(tenantId),
    });
  }

  async upsertSimbologia({
    simbologia,
    limite,
    tenantId = null,
    userId = null,
  }: UpsertSimbologiaInput) {
    const existing = await this.simbologiaModel.findOne({
      simbologia,
      ...tenantFilter(tenantId),
    });

    if (existing) {
      if (limite !== undefined && limite !== null) {
        existing.limite = limite;
        existing.updatedBy = (userId || existing.updatedBy) as never;
        await existing.save();
      }
      return existing;
    }

    if (limite === undefined || limite === null) {
      return null;
    }

    return this.simbologiaModel.create({
      simbologia,
      limite,
      tenantId: toObjectId(tenantId) as never,
      createdBy: (userId || null) as never,
      updatedBy: (userId || null) as never,
    });
  }
}
