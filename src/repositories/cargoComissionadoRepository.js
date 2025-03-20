const CargoComissionado = require('../models/CargoComissionadoSchema');

class CargoComissionadoRepository {
  static async buscarTodos() {
    return await CargoComissionado.find();
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
}

module.exports = CargoComissionadoRepository;
