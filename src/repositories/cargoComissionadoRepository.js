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
    ]);
  }

  static async buscarPorNome(nome) {
    return await CargoComissionado.findOne({ cargo: nome });
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

  static async updateLimite(simbologia, novoLimite) {
    return await Simbologia.findOneAndUpdate(
      { simbologia },
      { limite: novoLimite },
      { new: true }
    );
  }
}

module.exports = CargoComissionadoRepository;
