const mongoose = require('mongoose');
const Setor = require('../models/setoresSchema');

class SetorRepository {
  static tenantFilter(tenantId) {
    if (!tenantId) return {};
    const tid = mongoose.Types.ObjectId.isValid(tenantId)
      ? new mongoose.Types.ObjectId(tenantId)
      : tenantId;
    // Include legacy docs without tenantId until full migration
    return {
      $or: [
        { tenantId: tid },
        { tenantId: null },
        { tenantId: { $exists: false } },
      ],
    };
  }

  static async getAllSetores(tenantId = null) {
    return await Setor.find(this.tenantFilter(tenantId));
  }

  static async findById(id) {
    return await Setor.findById(id);
  }

  static async create(data) {
    return await new Setor(data).save();
  }

  static async findMainSetores(tenantId = null) {
    return await Setor.find({ parent: null, ...this.tenantFilter(tenantId) });
  }

  static async findSetorData(setorId, tenantId = null) {
    return await Setor.find({ parent: setorId, ...this.tenantFilter(tenantId) });
  }

  static async findSetorByCoordenadoria(setorIds) {
    return await Setor.find({ _id: { $in: setorIds } });
  }

  static async updateNome(id, nome, extra = {}) {
    return await Setor.findByIdAndUpdate(
      id,
      { nome, ...extra },
      { new: true }
    );
  }

  static async updateParent(id, parent, extra = {}) {
    return await Setor.findByIdAndUpdate(
      id,
      { parent, ...extra },
      { new: true }
    );
  }

  /**
   * Returns all descendant IDs including the root id (does not delete).
   */
  static async getDescendantIds(id) {
    const objectId = mongoose.Types.ObjectId.isValid(id)
      ? new mongoose.Types.ObjectId(id)
      : id;

    const setores = await Setor.aggregate([
      { $match: { _id: objectId } },
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

    if (!setores.length) return [];

    return setores.flatMap((s) => [
      s._id,
      ...s.descendants.map((d) => d._id),
    ]);
  }

  static async deleteWithChildren(id) {
    const idsParaDeletar = await this.getDescendantIds(id);
    if (!idsParaDeletar.length) return { deletedCount: 0 };
    return await Setor.deleteMany({ _id: { $in: idsParaDeletar } });
  }
}

module.exports = SetorRepository;
