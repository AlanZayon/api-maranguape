const CargoComissionado = require('../models/CargoComissionadoSchema');
const Simbologia = require('../models/limitesSimbologiaSchema');
const { tenantFilter, toObjectId } = require('../utils/tenantHelpers');

class CargoComissionadoRepository {
  static async buscarTodos(tenantId = null) {
    const match = tenantFilter(tenantId);
    const pipeline = [];
    if (Object.keys(match).length) {
      pipeline.push({ $match: match });
    }
    const lookupMatch = tenantId
      ? {
          $expr: {
            $and: [
              { $eq: ['$simbologia', '$$simb'] },
              { $eq: ['$tenantId', toObjectId(tenantId)] },
            ],
          },
        }
      : {
          $expr: { $eq: ['$simbologia', '$$simb'] },
        };
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
      { $sort: { cargo: 1 } }
    );
    return await CargoComissionado.aggregate(pipeline);
  }

  static async buscarPorId(id, tenantId = null) {
    return await CargoComissionado.findOne({
      _id: id,
      ...tenantFilter(tenantId),
    });
  }

  static async buscarPorNome(nome, tenantId = null) {
    return await CargoComissionado.findOne({
      cargo: nome,
      ...tenantFilter(tenantId),
    });
  }

  static async criar(data) {
    return await CargoComissionado.create(data);
  }

  static async atualizar(id, data, tenantId = null) {
    return await CargoComissionado.findOneAndUpdate(
      { _id: id, ...tenantFilter(tenantId) },
      data,
      {
        new: true,
        runValidators: true,
      }
    );
  }

  static async remover(id, tenantId = null) {
    return await CargoComissionado.findOneAndDelete({
      _id: id,
      ...tenantFilter(tenantId),
    });
  }

  static async contarPorSimbologia(simbologia, tenantId = null) {
    return await CargoComissionado.countDocuments({
      simbologia,
      ...tenantFilter(tenantId),
    });
  }

  static async updateLimit(cargoId, novoLimite, tenantId = null) {
    return await CargoComissionado.findOneAndUpdate(
      { _id: cargoId, ...tenantFilter(tenantId) },
      { limite: novoLimite },
      { new: true }
    );
  }

  static async buscarPorSimbologia(simbologia, tenantId = null) {
    return await Simbologia.findOne({
      simbologia,
      ...tenantFilter(tenantId),
    });
  }

  static async upsertSimbologia({
    simbologia,
    limite,
    tenantId = null,
    userId = null,
  }) {
    const existing = await Simbologia.findOne({
      simbologia,
      ...tenantFilter(tenantId),
    });

    if (existing) {
      if (limite !== undefined && limite !== null) {
        existing.limite = limite;
        existing.updatedBy = userId || existing.updatedBy;
        await existing.save();
      }
      return existing;
    }

    if (limite === undefined || limite === null) {
      return null;
    }

    return await Simbologia.create({
      simbologia,
      limite,
      tenantId: toObjectId(tenantId),
      createdBy: userId || null,
      updatedBy: userId || null,
    });
  }

  static async updateLimite(simbologia, novoLimite, tenantId = null) {
    return await Simbologia.findOneAndUpdate(
      { simbologia, ...tenantFilter(tenantId) },
      { limite: novoLimite },
      { new: true }
    );
  }
}

module.exports = CargoComissionadoRepository;
