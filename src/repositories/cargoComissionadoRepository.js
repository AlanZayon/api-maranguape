const CargoComissionado = require('../models/CargoComissionadoSchema');
const Simbologia = require('../models/limitesSimbologiaSchema');

class CargoComissionadoRepository {
  static async buscarTodos() {
    return await CargoComissionado.aggregate([
      {
        $lookup: {
          from: 'simbologias',
          localField: 'simbologia',
          foreignField: 'simbologia',
          as: 'simbologiaInfo',
        },
      },
      {
        $unwind: '$simbologiaInfo',
      },
      { $sort: { cargo: 1 } },
    ]);
  }

  static async buscarPorId(id) {
    return await CargoComissionado.findById(id);
  }

  static async buscarPorNome(nome) {
    return await CargoComissionado.findOne({ cargo: nome });
  }

  static async criar(data) {
    return await CargoComissionado.create(data);
  }

  static async atualizar(id, data) {
    return await CargoComissionado.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  static async remover(id) {
    return await CargoComissionado.findByIdAndDelete(id);
  }

  static async contarPorSimbologia(simbologia) {
    return await CargoComissionado.countDocuments({ simbologia });
  }

  static async updateLimit(cargoId, novoLimite) {
    return await CargoComissionado.findByIdAndUpdate(
      { _id: cargoId },
      { limite: novoLimite },
      { new: true }
    );
  }

  static async buscarPorSimbologia(simbologia) {
    return await Simbologia.findOne({ simbologia });
  }

  static async upsertSimbologia({
    simbologia,
    limite,
    tenantId = null,
    userId = null,
  }) {
    const existing = await Simbologia.findOne({ simbologia });

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
      tenantId,
      createdBy: userId || null,
      updatedBy: userId || null,
    });
  }

  static async updateLimite(simbologia, novoLimite) {
    return await Simbologia.findOneAndUpdate(
      { simbologia },
      { limite: novoLimite },
      { new: true }
    );
  }
}

module.exports = CargoComissionadoRepository;
