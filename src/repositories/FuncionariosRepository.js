const mongoose = require('mongoose');
const Funcionario = require('../models/funcionariosSchema');
const Setores = require('../models/setoresSchema');

class FuncionarioRepository {
  static async findByName(name, tenantId = null) {
    return await Funcionario.findOne({ nome: name, ...this.tenantFilter(tenantId) });
  }

  static findByIds(userIds) {
    return Funcionario.find({ _id: { $in: userIds } }).lean();
  }

  /** Funcionários lotados exatamente nestes nós (Setor/Subsetor). */
  static findBySetorId(setorIds, tenantId = null) {
    const ids = Array.isArray(setorIds) ? setorIds : [setorIds];
    return Funcionario.find({
      setorId: { $in: ids },
      ...this.tenantFilter(tenantId),
    }).lean();
  }

  /** @deprecated use findBySetorId */
  static findByCoordenadoria(ids, tenantId = null) {
    return this.findBySetorId(ids, tenantId);
  }

  static toObjectIds(ids) {
    const arr = Array.isArray(ids) ? ids : [ids];
    return arr.map((id) =>
      mongoose.Types.ObjectId.isValid(id) && !(id instanceof mongoose.Types.ObjectId)
        ? new mongoose.Types.ObjectId(id)
        : id
    );
  }

  static tenantFilter(tenantId) {
    if (!tenantId) return {};
    return {
      tenantId: mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId,
    };
  }

  static async countDocuments(tenantId = null) {
    return await Funcionario.countDocuments(this.tenantFilter(tenantId));
  }

  static findAll(tenantId = null) {
    return Funcionario.find(this.tenantFilter(tenantId)).lean();
  }

  static async countBySetor(idsSetores, tenantId = null) {
    const idsArray = this.toObjectIds(idsSetores);
    const match = { _id: { $in: idsArray }, ...this.tenantFilter(tenantId) };

    const result = await Setores.aggregate([
      { $match: match },
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
        $addFields: {
          allIds: { $concatArrays: [['$_id'], '$hierarquia._id'] },
        },
      },
      {
        $lookup: {
          from: 'funcionarios',
          localField: 'allIds',
          foreignField: 'setorId',
          as: 'funcionarios',
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: { $size: '$funcionarios' } },
        },
      },
    ]);

    return result[0]?.count || 0;
  }

  static async buscarFuncionariosPorSetor(idSetor, skip = 0, limit = 100, tenantId = null) {
    const [objectId] = this.toObjectIds(idSetor);
    const match = { _id: objectId, ...this.tenantFilter(tenantId) };

    return await Setores.aggregate([
      { $match: match },
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
        $addFields: {
          allIds: { $concatArrays: [['$_id'], '$hierarquia._id'] },
        },
      },
      {
        $lookup: {
          from: 'funcionarios',
          localField: 'allIds',
          foreignField: 'setorId',
          as: 'funcionarios',
        },
      },
      { $unwind: '$funcionarios' },
      { $replaceRoot: { newRoot: '$funcionarios' } },
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

  static async updateSetorId(userIds, newSetorId) {
    const ids = this.toObjectIds(userIds);
    const setorId = this.toObjectIds(newSetorId)[0];

    await Funcionario.updateMany(
      { _id: { $in: ids } },
      { $set: { setorId } }
    );
  }

  /** @deprecated use updateSetorId */
  static async updateCoordenadoria(userIds, newCoordId) {
    return this.updateSetorId(userIds, newCoordId);
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

  static async countFuncionariosInSetores(setorIds) {
    return await Funcionario.countDocuments({
      setorId: { $in: setorIds },
    });
  }

  static async countFuncionariosInSetor(setorId) {
    return await Funcionario.countDocuments({
      setorId,
    });
  }

  /** @deprecated */
  static async countFuncionariosInCoordenadorias(ids) {
    return this.countFuncionariosInSetores(ids);
  }

  /** @deprecated */
  static async countFuncionariosInCoordenadoria(id) {
    return this.countFuncionariosInSetor(id);
  }

  static async countFuncionariosPorSetor(tenantId = null) {
    const pipeline = [];
    const filter = this.tenantFilter(tenantId);
    if (Object.keys(filter).length) {
      pipeline.push({ $match: filter });
    }
    pipeline.push({ $group: { _id: '$setorId', total: { $sum: 1 } } });

    const result = await Funcionario.aggregate(pipeline);

    return result.reduce((acc, { _id, total }) => {
      if (_id) acc[String(_id)] = total;
      return acc;
    }, {});
  }

  static findBySetores(idsSetores, skip, limit, tenantId = null) {
    const objectIdArray = idsSetores.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    return Funcionario.aggregate([
      {
        $match: {
          setorId: { $in: objectIdArray },
          ...this.tenantFilter(tenantId),
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);
  }

  /** @deprecated use findBySetores */
  static findByDivisoes(ids, skip, limit, tenantId = null) {
    return this.findBySetores(ids, skip, limit, tenantId);
  }

  static async findForExport(tenantId = null) {
    return Funcionario.find(this.tenantFilter(tenantId))
      .select('nome secretaria funcao natureza referencia salarioBruto')
      .lean();
  }

  static async countByTenant(tenantId = null) {
    return Funcionario.countDocuments(this.tenantFilter(tenantId));
  }

  static async countContratosAVencer(days, tenantId = null) {
    const now = new Date();
    const until = new Date();
    until.setDate(until.getDate() + days);

    return Funcionario.countDocuments({
      ...this.tenantFilter(tenantId),
      fimContrato: {
        $type: 'date',
        $gte: now,
        $lte: until,
      },
    });
  }
}

module.exports = FuncionarioRepository;
