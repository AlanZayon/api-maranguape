import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { CargoComissionadoDocument } from '../../cargos-comissionados/schemas/cargo-comissionado.schema';
import { LimiteSimbologiaDocument } from '../schemas/limite-simbologia.schema';
import {
  CARGO_MODEL,
  SIMBOLOGIA_MODEL,
} from '../../../database/database.module';
import { tenantFilter, idMatchValues } from '../../../common/utils/tenant.helpers';

/**
 * Narrow read/write surface into cargos comissionados + limites de
 * simbologia, needed by funcionário create/update/delete flows.
 * Ported from legacy/repositories/cargoComissionadoRepository.js
 * (only the members used by FuncionariosService/LimiteService).
 */
@Injectable()
export class CargoLookupRepository {
  constructor(
    @InjectModel(CARGO_MODEL)
    private readonly cargoModel: Model<CargoComissionadoDocument>,
    @InjectModel(SIMBOLOGIA_MODEL)
    private readonly simbologiaModel: Model<LimiteSimbologiaDocument>,
  ) {}

  buscarPorNome(nome: string, tenantId: string | null = null) {
    return this.cargoModel.findOne({ cargo: nome, ...tenantFilter(tenantId) });
  }

  buscarPorSimbologia(simbologia: string, tenantId: string | null = null) {
    return this.simbologiaModel.findOne({
      simbologia,
      ...tenantFilter(tenantId),
    });
  }

  updateLimite(
    simbologia: string,
    novoLimite: number,
    tenantId: string | null = null,
  ) {
    return this.simbologiaModel.findOneAndUpdate(
      { simbologia, ...tenantFilter(tenantId) },
      { limite: novoLimite },
      { new: true },
    );
  }

  async buscarTodos(tenantId: string | null = null) {
    const match = tenantFilter(tenantId);
    const pipeline: PipelineStage[] = [];
    if (Object.keys(match).length) {
      pipeline.push({ $match: match });
    }
    // $expr cannot use query-form { tenantId: { $in: [...] } }; use $in op.
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
}
