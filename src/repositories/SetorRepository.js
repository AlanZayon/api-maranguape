const mongoose = require('mongoose');
const Setor = require('../models/setoresSchema');

class SetorRepository {
  static async getAllSetores() {
    return await Setor.find();
  }

  static async create(data) {
    return await new Setor(data).save();
  }

  static async findMainSetores() {
    return await Setor.find({ parent: null });
  }

  static async findSetorData(setorId) {
    return await Setor.find({ parent: setorId });
  }

  static async findSetorByCoordenadoria(setorIds) {
    return await Setor.find({ setorId: { $in: setorIds } });
  }

  static async updateNome(id, nome) {
    return await Setor.findByIdAndUpdate(id, { nome }, { new: true });
  }

  static async deleteWithChildren(id) {
    const objectId = mongoose.Types.ObjectId.isValid(id)
      ? new mongoose.Types.ObjectId(id)
      : id;

    const setoresParaDeletar = await Setor.aggregate([
      {
        $match: { _id: objectId },
      },
      {
        $graphLookup: {
          from: 'setors',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent',
          as: 'descendants',
        },
      },
    ]);

    const idsParaDeletar = setoresParaDeletar.flatMap((s) => [
      s._id,
      ...s.descendants.map((d) => d._id),
    ]);

    return await Setor.deleteMany({ _id: { $in: idsParaDeletar } });
  }
}

module.exports = SetorRepository;
