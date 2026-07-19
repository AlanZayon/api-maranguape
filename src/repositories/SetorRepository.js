const mongoose = require('mongoose');
const Setor = require('../models/setoresSchema');

class SetorRepository {
  static tenantFilter(tenantId) {
    if (!tenantId) return {};
    const tid = mongoose.Types.ObjectId.isValid(tenantId)
      ? new mongoose.Types.ObjectId(tenantId)
      : tenantId;
    return { tenantId: tid };
  }

  static async getAllSetores(tenantId = null) {
    return await Setor.find(this.tenantFilter(tenantId));
  }

  static async findById(id, tenantId = null) {
    const filter = { _id: id, ...this.tenantFilter(tenantId) };
    return await Setor.findOne(filter);
  }

  static async create(data) {
    return await new Setor(data).save();
  }

  static async findMainSetores(tenantId = null) {
    return await Setor.find({ parent: null, ...this.tenantFilter(tenantId) });
  }

  /**
   * Direct children of a parent. Pass null/undefined for roots.
   */
  static async findChildren(parentId = null, tenantId = null) {
    const parent =
      parentId === undefined || parentId === null || parentId === ''
        ? null
        : parentId;
    return await Setor.find({
      parent,
      ...this.tenantFilter(tenantId),
    });
  }

  static async findSetorData(setorId, tenantId = null) {
    return await Setor.find({ parent: setorId, ...this.tenantFilter(tenantId) });
  }

  static async findSetorByCoordenadoria(setorIds, tenantId = null) {
    return await Setor.find({
      _id: { $in: setorIds },
      ...this.tenantFilter(tenantId),
    });
  }

  static async updateNome(id, nome, extra = {}, tenantId = null) {
    return await Setor.findOneAndUpdate(
      { _id: id, ...this.tenantFilter(tenantId) },
      { nome, ...extra },
      { new: true }
    );
  }

  static async updateParent(id, parent, extra = {}, tenantId = null) {
    return await Setor.findOneAndUpdate(
      { _id: id, ...this.tenantFilter(tenantId) },
      { parent, ...extra },
      { new: true }
    );
  }

  /**
   * Returns all descendant IDs including the root id (does not delete).
   */
  static async getDescendantIds(id, tenantId = null) {
    const objectId = mongoose.Types.ObjectId.isValid(id)
      ? new mongoose.Types.ObjectId(id)
      : id;

    const match = { _id: objectId, ...this.tenantFilter(tenantId) };

    const setores = await Setor.aggregate([
      { $match: match },
      {
        $graphLookup: {
          from: 'setors',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent',
          as: 'descendants',
          ...(tenantId
            ? {
                restrictSearchWithMatch: this.tenantFilter(tenantId),
              }
            : {}),
        },
      },
    ]);

    if (!setores.length) return [];

    return setores.flatMap((s) => [
      s._id,
      ...s.descendants.map((d) => d._id),
    ]);
  }

  static async deleteWithChildren(id, tenantId = null) {
    const idsParaDeletar = await this.getDescendantIds(id, tenantId);
    if (!idsParaDeletar.length) return { deletedCount: 0 };
    return await Setor.deleteMany({
      _id: { $in: idsParaDeletar },
      ...this.tenantFilter(tenantId),
    });
  }
}

module.exports = SetorRepository;
