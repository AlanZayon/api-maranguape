const Funcionario = require('../models/funcionariosSchema');

class FuncionarioRepository {
  static findAll() {
    return Funcionario.find().lean();
  }

  static findByIds(userIds) {
    return Funcionario.find({ _id: { $in: userIds } }).lean();
  }

  static findByCoordenadoria(coordenadoriaIds) {
    return Funcionario.find({
      coordenadoria: { $in: coordenadoriaIds },
    }).lean();
  }

  static create(data) {
    return new Funcionario(data).save();
  }

  static async update(id, data) {
    return Funcionario.findByIdAndUpdate(id, data, { new: true });
  }

  static deleteBatch(userIds) {
    return Funcionario.deleteMany({ _id: { $in: userIds } });
  }

  static async updateCoordenadoria(userIds, newCoordId) {
    const session = await Funcionario.startSession();
    session.startTransaction();

    try {
      const operations = userIds.map((userId) => ({
        updateOne: {
          filter: { _id: userId },
          update: { $set: { coordenadoria: newCoordId } },
        },
      }));
      await Funcionario.bulkWrite(operations, { session });

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  static save(user) {
    return user.save();
  }

  static contarTotal() {
    return Funcionario.countDocuments();
  }

  static agruparPorReferencia() {
    return Funcionario.aggregate([
      { $group: { _id: '$referencia', total: { $sum: 1 } } },
    ]);
  }
}

module.exports = FuncionarioRepository;
