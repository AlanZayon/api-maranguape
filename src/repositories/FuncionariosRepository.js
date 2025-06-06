const Funcionario = require('../models/funcionariosSchema');
const Setores = require('../models/setoresSchema');

class FuncionarioRepository {
  static async countDocuments() {
    return await Funcionario.countDocuments();
  }

  static findAll() {
    return Funcionario.find().lean();
  }

  static async findByName(name) {
    return await Funcionario.findOne({ nome: name });
  }

  static findByIds(userIds) {
    return Funcionario.find({ _id: { $in: userIds } }).lean();
  }

  static findByCoordenadoria(coordenadoriaIds) {
    return Funcionario.find({
      coordenadoria: { $in: coordenadoriaIds },
    }).lean();
  }

  static async countBySetor(idSetor) {
    const result = await Setores.aggregate([
      {
        $match: { _id: idSetor },
      },
      {
        $graphLookup: {
          from: 'setors',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent',
          as: 'hierarquia',
        },
      },
      {
        $lookup: {
          from: 'funcionarios',
          localField: 'hierarquia._id',
          foreignField: 'coordenadoria',
          as: 'funcionarios',
        },
      },
      {
        $project: {
          count: { $size: '$funcionarios' },
        },
      },
    ]);

    return result[0]?.count || 0;
  }

  static async buscarFuncionariosPorSetor(idSetor, skip = 0, limit = 100) {
    return await Setores.aggregate([
      {
        $match: { _id: idSetor },
      },
      {
        $graphLookup: {
          from: 'setors',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent',
          as: 'hierarquia',
        },
      },
      {
        $lookup: {
          from: 'funcionarios',
          localField: 'hierarquia._id',
          foreignField: 'coordenadoria',
          as: 'funcionarios',
        },
      },
      {
        $unwind: '$funcionarios',
      },
      {
        $replaceRoot: {
          newRoot: '$funcionarios',
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);
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

  static async updateObservacoes(userId, observacoes) {
    return Funcionario.findByIdAndUpdate(
      userId,
      { observacoes },
      { new: true }
    );
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
