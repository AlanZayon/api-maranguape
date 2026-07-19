const mongoose = require('mongoose');
const Funcionario = require('../models/funcionariosSchema');
const Setores = require('../models/setoresSchema');

class FuncionarioRepository {
  static async findByName(name, tenantId = null) {
    return await Funcionario.findOne({ nome: name, ...this.tenantFilter(tenantId) });
  }

  static findByIds(userIds, tenantId = null) {
    return Funcionario.find({
      _id: { $in: userIds },
      ...this.tenantFilter(tenantId),
    }).lean();
  }

  static findById(id, tenantId = null) {
    return Funcionario.findOne({
      _id: id,
      ...this.tenantFilter(tenantId),
    }).lean();
  }

  static escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Shared list/selection filter match.
   * @param {{ q?: string, natureza?: string, secretaria?: string, funcao?: string, bairro?: string, referencia?: string }} filters
   */
  static buildListMatch(filters = {}, tenantId = null) {
    const match = { ...this.tenantFilter(tenantId) };
    const { q, natureza, secretaria, funcao, bairro, referencia } = filters;

    if (q && String(q).trim()) {
      const regex = new RegExp(this.escapeRegex(String(q).trim()), 'i');
      match.$or = [
        { nome: regex },
        { funcao: regex },
        { secretaria: regex },
        { bairro: regex },
        { cidade: regex },
        { natureza: regex },
        { referencia: regex },
        { telefone: regex },
        { tipo: regex },
      ];
    }

    if (natureza && String(natureza).trim()) {
      match.natureza = new RegExp(
        `^${this.escapeRegex(String(natureza).trim())}$`,
        'i'
      );
    }

    if (secretaria && String(secretaria).trim()) {
      match.secretaria = new RegExp(
        `^${this.escapeRegex(String(secretaria).trim())}$`,
        'i'
      );
    }

    if (funcao && String(funcao).trim()) {
      match.funcao = new RegExp(
        `^${this.escapeRegex(String(funcao).trim())}$`,
        'i'
      );
    }

    if (bairro && String(bairro).trim()) {
      match.bairro = new RegExp(
        `^${this.escapeRegex(String(bairro).trim())}$`,
        'i'
      );
    }

    if (referencia && String(referencia).trim()) {
      match.referencia = new RegExp(
        `^${this.escapeRegex(String(referencia).trim())}$`,
        'i'
      );
    }

    return match;
  }

  /** @deprecated use buildListMatch */
  static buildSelecaoMatch(filters = {}, tenantId = null) {
    return this.buildListMatch(filters, tenantId);
  }

  static async countParaSelecao(filters = {}, tenantId = null) {
    return Funcionario.countDocuments(this.buildSelecaoMatch(filters, tenantId));
  }

  static async findParaSelecao(filters = {}, skip = 0, limit = 15, tenantId = null) {
    return Funcionario.find(this.buildSelecaoMatch(filters, tenantId))
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .select('nome funcao secretaria natureza telefone tipo referencia bairro cidade')
      .lean();
  }

  static async distinctFiltrosSelecao(tenantId = null) {
    const filter = this.tenantFilter(tenantId);
    const [naturezas, secretarias, funcoes, bairros, referencias] =
      await Promise.all([
        Funcionario.distinct('natureza', filter),
        Funcionario.distinct('secretaria', filter),
        Funcionario.distinct('funcao', filter),
        Funcionario.distinct('bairro', filter),
        Funcionario.distinct('referencia', filter),
      ]);

    const cleanSort = (arr) =>
      arr
        .filter((v) => v != null && String(v).trim() !== '')
        .map(String)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return {
      naturezas: cleanSort(naturezas),
      secretarias: cleanSort(secretarias),
      funcoes: cleanSort(funcoes),
      bairros: cleanSort(bairros),
      referencias: cleanSort(referencias),
    };
  }

  static async countWithFilters(filters = {}, tenantId = null) {
    return Funcionario.countDocuments(this.buildListMatch(filters, tenantId));
  }

  static findWithFilters(filters = {}, skip = 0, limit = 50, tenantId = null) {
    return Funcionario.find(this.buildListMatch(filters, tenantId))
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static findBySetoresFiltered(
    idsSetores,
    skip,
    limit,
    tenantId = null,
    filters = {}
  ) {
    const objectIdArray = this.toObjectIds(idsSetores);
    const match = {
      ...this.buildListMatch(filters, tenantId),
      setorId: { $in: objectIdArray },
    };
    return Funcionario.find(match)
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async countBySetoresExact(idsSetores, tenantId = null, filters = {}) {
    const objectIdArray = this.toObjectIds(idsSetores);
    if (!objectIdArray.length) return 0;
    const match = {
      ...this.buildListMatch(filters, tenantId),
      setorId: { $in: objectIdArray },
    };
    return Funcionario.countDocuments(match);
  }

  /** Returns only _id for select-all-filtered without loading full docs. */
  static async findIdsOnly(filters = {}, tenantId = null, { setorIds = null, subtreeRoot = null, max = 10000 } = {}) {
    let match = this.buildListMatch(filters, tenantId);
    if (subtreeRoot) {
      const ids = await this.getDescendantSetorIds(subtreeRoot, tenantId);
      if (!ids.length) return [];
      match = { ...match, setorId: { $in: ids } };
    } else if (setorIds && setorIds.length) {
      match = { ...match, setorId: { $in: this.toObjectIds(setorIds) } };
    }
    const docs = await Funcionario.find(match).select('_id').limit(max).lean();
    return docs.map((d) => d._id);
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

  /**
   * Collects unique setor IDs for the given roots including all descendants.
   * Uses $graphLookup only for IDs — never materializes employee documents.
   */
  static async getDescendantSetorIds(idsSetores, tenantId = null) {
    const idsArray = this.toObjectIds(idsSetores);
    if (!idsArray.length) return [];

    const match = { _id: { $in: idsArray }, ...this.tenantFilter(tenantId) };
    const rows = await Setores.aggregate([
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
        $project: {
          allIds: { $concatArrays: [['$_id'], '$hierarquia._id'] },
        },
      },
      { $unwind: '$allIds' },
      { $group: { _id: null, ids: { $addToSet: '$allIds' } } },
    ]);

    return rows[0]?.ids || [];
  }

  /** Count employees under setor roots including descendants (no double-count). */
  static async countBySetor(idsSetores, tenantId = null, filters = {}) {
    const setorIds = await this.getDescendantSetorIds(idsSetores, tenantId);
    if (!setorIds.length) return 0;

    const match = {
      ...this.buildListMatch(filters, tenantId),
      setorId: { $in: setorIds },
    };
    return Funcionario.countDocuments(match);
  }

  /**
   * Paginated employees under a setor subtree.
   * Collects descendant IDs first, then find + skip/limit (no full $lookup).
   */
  static async buscarFuncionariosPorSetor(
    idSetor,
    skip = 0,
    limit = 50,
    tenantId = null,
    filters = {}
  ) {
    const setorIds = await this.getDescendantSetorIds(idSetor, tenantId);
    if (!setorIds.length) return [];

    const match = {
      ...this.buildListMatch(filters, tenantId),
      setorId: { $in: setorIds },
    };

    return Funcionario.find(match)
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static create(data) {
    return new Funcionario(data).save();
  }

  static async update(id, data, tenantId = null) {
    return Funcionario.findOneAndUpdate(
      { _id: id, ...this.tenantFilter(tenantId) },
      data,
      { new: true }
    );
  }

  static deleteBatch(userIds, tenantId = null) {
    return Funcionario.deleteMany({
      _id: { $in: userIds },
      ...this.tenantFilter(tenantId),
    });
  }

  static async updateSetorId(userIds, newSetorId, tenantId = null) {
    const ids = this.toObjectIds(userIds);
    const setorId = this.toObjectIds(newSetorId)[0];

    await Funcionario.updateMany(
      { _id: { $in: ids }, ...this.tenantFilter(tenantId) },
      { $set: { setorId } }
    );
  }

  /** @deprecated use updateSetorId */
  static async updateCoordenadoria(userIds, newCoordId, tenantId = null) {
    return this.updateSetorId(userIds, newCoordId, tenantId);
  }

  static async updateObservacoes(userId, observacoes, tenantId = null) {
    return Funcionario.findOneAndUpdate(
      { _id: userId, ...this.tenantFilter(tenantId) },
      { observacoes },
      { new: true }
    );
  }

  static contarTotal(tenantId = null) {
    return Funcionario.countDocuments(this.tenantFilter(tenantId));
  }

  static agruparPorReferencia(tenantId = null) {
    const match = this.tenantFilter(tenantId);
    const pipeline = [];
    if (Object.keys(match).length) {
      pipeline.push({ $match: match });
    }
    pipeline.push({ $group: { _id: '$referencia', total: { $sum: 1 } } });
    return Funcionario.aggregate(pipeline);
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

  static async findForExport(tenantId = null, ids = null) {
    const filter = { ...this.tenantFilter(tenantId) };
    if (Array.isArray(ids) && ids.length > 0) {
      filter._id = { $in: ids };
    }
    return Funcionario.find(filter)
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

  static async groupByField(field, tenantId = null, { topN = null } = {}) {
    const pipeline = [
      { $match: this.tenantFilter(tenantId) },
      {
        $group: {
          _id: { $ifNull: [`$${field}`, 'Não informada'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ];
    if (topN) pipeline.push({ $limit: topN });

    const rows = await Funcionario.aggregate(pipeline);
    return rows.map((r) => ({ [field]: r._id || 'Não informada', count: r.count }));
  }

  static async countContratosBuckets(tenantId = null) {
    const now = new Date();
    const d30 = new Date(now);
    d30.setDate(d30.getDate() + 30);
    const d60 = new Date(now);
    d60.setDate(d60.getDate() + 60);
    const d90 = new Date(now);
    d90.setDate(d90.getDate() + 90);

    const filter = this.tenantFilter(tenantId);
    const [row] = await Funcionario.aggregate([
      { $match: filter },
      {
        $facet: {
          in30: [
            {
              $match: {
                fimContrato: { $type: 'date', $gte: now, $lte: d30 },
              },
            },
            { $count: 'n' },
          ],
          in31to60: [
            {
              $match: {
                fimContrato: { $type: 'date', $gt: d30, $lte: d60 },
              },
            },
            { $count: 'n' },
          ],
          in61to90: [
            {
              $match: {
                fimContrato: { $type: 'date', $gt: d60, $lte: d90 },
              },
            },
            { $count: 'n' },
          ],
          expired: [
            {
              $match: {
                fimContrato: { $type: 'date', $lt: now },
              },
            },
            { $count: 'n' },
          ],
          indeterminado: [
            { $match: { fimContrato: 'indeterminado' } },
            { $count: 'n' },
          ],
        },
      },
    ]);

    const countOf = (bucket) => bucket?.[0]?.n || 0;

    return {
      in30: countOf(row?.in30),
      in31to60: countOf(row?.in31to60),
      in61to90: countOf(row?.in61to90),
      expired: countOf(row?.expired),
      indeterminado: countOf(row?.indeterminado),
    };
  }

  static async findContratosAVencer(tenantId = null, { withinDays = 90, limit = 20 } = {}) {
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + withinDays);

    const docs = await Funcionario.find({
      ...this.tenantFilter(tenantId),
      fimContrato: { $type: 'date', $gte: now, $lte: until },
    })
      .select('nome natureza secretaria setorId fimContrato')
      .sort({ fimContrato: 1 })
      .limit(limit)
      .lean();

    const msPerDay = 1000 * 60 * 60 * 24;
    return docs.map((doc) => {
      const fim = new Date(doc.fimContrato);
      const diasRestantes = Math.max(0, Math.ceil((fim - now) / msPerDay));
      return {
        _id: doc._id,
        nome: doc.nome,
        natureza: doc.natureza,
        secretaria: doc.secretaria,
        setorId: doc.setorId,
        fimContrato: doc.fimContrato,
        diasRestantes,
      };
    });
  }

  static async aggregatePayroll(tenantId = null, { topSecretarias = 10 } = {}) {
    const filter = this.tenantFilter(tenantId);
    const salarioExpr = {
      $convert: {
        input: '$salarioBruto',
        to: 'double',
        onError: 0,
        onNull: 0,
      },
    };

    const [totals, byNatureza, bySecretaria] = await Promise.all([
      Funcionario.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: salarioExpr },
            media: { $avg: salarioExpr },
            count: { $sum: 1 },
          },
        },
      ]),
      Funcionario.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ['$natureza', 'Não informada'] },
            total: { $sum: salarioExpr },
            media: { $avg: salarioExpr },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Funcionario.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ['$secretaria', 'Não informada'] },
            total: { $sum: salarioExpr },
            media: { $avg: salarioExpr },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: topSecretarias },
      ]),
    ]);

    const t = totals[0] || { total: 0, media: 0, count: 0 };
    return {
      total: t.total || 0,
      media: t.media || 0,
      count: t.count || 0,
      byNatureza: byNatureza.map((r) => ({
        natureza: r._id,
        total: r.total,
        media: r.media,
        count: r.count,
      })),
      bySecretaria: bySecretaria.map((r) => ({
        secretaria: r._id,
        total: r.total,
        media: r.media,
        count: r.count,
      })),
    };
  }
}

module.exports = FuncionarioRepository;
