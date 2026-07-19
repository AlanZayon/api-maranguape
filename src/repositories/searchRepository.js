// Data-access layer for search queries against MongoDB models.
const Funcionario = require('../models/funcionariosSchema');
const Setor = require('../models/setoresSchema');
const { tenantFilter } = require('../utils/tenantHelpers');

class SearchRepository {
  static escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static isMissingSearchIndex(error) {
    const message = String(error?.message || '');
    return (
      error?.code === 27 ||
      error?.codeName === 'IndexNotFound' ||
      message.includes('text index required') ||
      message.includes('$search') ||
      message.includes('Unrecognized pipeline stage') ||
      message.includes('PlanExecutor error')
    );
  }

  static tenantMatchStage(tenantId) {
    const filter = tenantFilter(tenantId);
    if (!Object.keys(filter).length) return null;
    return { $match: filter };
  }

  static async findChildIds(parentId, tenantId = null) {
    const children = await Setor.find({
      parent: parentId,
      ...tenantFilter(tenantId),
    });
    let ids = [parentId];

    for (const child of children) {
      const childIds = await this.findChildIds(child._id, tenantId);
      ids = [...ids, ...childIds];
    }

    return ids;
  }

  static async autocompleteFuncionarios(termo, tenantId = null) {
    const tenantStage = this.tenantMatchStage(tenantId);
    try {
      const pipeline = [
        {
          $search: {
            index: 'autocomplete_funcionarios',
            compound: {
              should: [
                { autocomplete: { query: termo, path: 'nome' } },
                { autocomplete: { query: termo, path: 'funcao' } },
                { autocomplete: { query: termo, path: 'bairro' } },
                { autocomplete: { query: termo, path: 'cidade' } },
                { autocomplete: { query: termo, path: 'natureza' } },
                { autocomplete: { query: termo, path: 'tipo' } },
                { autocomplete: { query: termo, path: 'referencia' } },
              ],
            },
          },
        },
      ];
      if (tenantStage) pipeline.push(tenantStage);
      pipeline.push(
        { $limit: 10 },
        {
          $project: {
            termo: {
              $cond: [
                { $regexMatch: { input: '$nome', regex: termo, options: 'i' } },
                { nome: '$nome', tipo: 'Funcionário' },
                {
                  $cond: [
                    {
                      $regexMatch: {
                        input: '$funcao',
                        regex: termo,
                        options: 'i',
                      },
                    },
                    { nome: '$funcao', tipo: 'Função' },
                    {
                      $cond: [
                        {
                          $regexMatch: {
                            input: '$bairro',
                            regex: termo,
                            options: 'i',
                          },
                        },
                        { nome: '$bairro', tipo: 'Bairro' },
                        {
                          $cond: [
                            {
                              $regexMatch: {
                                input: '$cidade',
                                regex: termo,
                                options: 'i',
                              },
                            },
                            { nome: '$cidade', tipo: 'Cidade' },
                            {
                              $cond: [
                                {
                                  $regexMatch: {
                                    input: '$natureza',
                                    regex: termo,
                                    options: 'i',
                                  },
                                },
                                { nome: '$natureza', tipo: 'Natureza' },
                                {
                                  $cond: [
                                    {
                                      $regexMatch: {
                                        input: '$tipo',
                                        regex: termo,
                                        options: 'i',
                                      },
                                    },
                                    { nome: '$tipo', tipo: 'Tipo' },
                                    { nome: '$referencia', tipo: 'Referência' },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        }
      );
      return await Funcionario.aggregate(pipeline);
    } catch (error) {
      if (!this.isMissingSearchIndex(error)) throw error;
      return this.autocompleteFuncionariosRegex(termo, tenantId);
    }
  }

  static async autocompleteFuncionariosRegex(termo, tenantId = null) {
    const regex = new RegExp(this.escapeRegex(termo), 'i');
    const funcionarios = await Funcionario.find({
      ...tenantFilter(tenantId),
      $or: [
        { nome: regex },
        { funcao: regex },
        { bairro: regex },
        { cidade: regex },
      ],
    })
      .limit(10)
      .select('nome funcao bairro cidade')
      .lean();

    return funcionarios.map((f) => {
      if (regex.test(f.nome || '')) {
        return { termo: { nome: f.nome, tipo: 'Funcionário' } };
      }
      if (regex.test(f.funcao || '')) {
        return { termo: { nome: f.funcao, tipo: 'Função' } };
      }
      if (regex.test(f.bairro || '')) {
        return { termo: { nome: f.bairro, tipo: 'Bairro' } };
      }
      return { termo: { nome: f.cidade, tipo: 'Cidade' } };
    });
  }

  static async autocompleteSetores(termo, tenantId = null) {
    const tenantStage = this.tenantMatchStage(tenantId);
    try {
      const pipeline = [
        {
          $search: {
            index: 'autocomplete_setores',
            compound: {
              should: [{ autocomplete: { query: termo, path: 'nome' } }],
            },
          },
        },
      ];
      if (tenantStage) pipeline.push(tenantStage);
      pipeline.push(
        { $limit: 10 },
        {
          $project: {
            termo: {
              nome: '$nome',
              tipo: '$tipo',
            },
          },
        }
      );
      return await Setor.aggregate(pipeline);
    } catch (error) {
      if (!this.isMissingSearchIndex(error)) throw error;
      const regex = new RegExp(this.escapeRegex(termo), 'i');
      const setores = await Setor.find({
        nome: regex,
        ...tenantFilter(tenantId),
      })
        .limit(10)
        .select('nome tipo')
        .lean();
      return setores.map((s) => ({
        termo: { nome: s.nome, tipo: s.tipo },
      }));
    }
  }

  static async searchSetores(q, tenantId = null) {
    try {
      return await Setor.find(
        { $text: { $search: q }, ...tenantFilter(tenantId) },
        { score: { $meta: 'textScore' }, tipo: 1, nome: 1 }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(5)
        .select('_id tipo nome');
    } catch (error) {
      if (!this.isMissingSearchIndex(error)) throw error;
      const regex = new RegExp(this.escapeRegex(q), 'i');
      return await Setor.find({
        nome: regex,
        ...tenantFilter(tenantId),
      })
        .limit(5)
        .select('_id tipo nome');
    }
  }

  static async findFuncionariosBySetorId(setorId, tenantId = null) {
    return await Funcionario.find({
      setorId,
      ...tenantFilter(tenantId),
    }).select('_id');
  }

  /** @deprecated use findFuncionariosBySetorId */
  static async findFuncionariosByCoordenadoria(coordenadoriaId, tenantId = null) {
    return this.findFuncionariosBySetorId(coordenadoriaId, tenantId);
  }

  static async searchFuncionariosDirectly(q, tenantId = null) {
    const tenantStage = this.tenantMatchStage(tenantId);
    try {
      const pipeline = [
        {
          $search: {
            index: 'busca_geral_funcionarios',
            text: {
              query: q,
              path: [
                'bairro',
                'cidade',
                'funcao',
                'natureza',
                'nome',
                'referencia',
                'tipo',
              ],
            },
          },
        },
      ];
      if (tenantStage) pipeline.push(tenantStage);
      pipeline.push({ $limit: 20 }, { $project: { _id: 1 } });
      return await Funcionario.aggregate(pipeline);
    } catch (error) {
      if (!this.isMissingSearchIndex(error)) throw error;
      const regex = new RegExp(this.escapeRegex(q), 'i');
      return await Funcionario.find({
        ...tenantFilter(tenantId),
        $or: [
          { nome: regex },
          { funcao: regex },
          { secretaria: regex },
          { natureza: regex },
          { referencia: regex },
          { bairro: regex },
          { cidade: regex },
        ],
      })
        .limit(20)
        .select('_id');
    }
  }

  static async getFuncionariosByIds(ids, tenantId = null) {
    return await Funcionario.find({
      _id: { $in: ids },
      ...tenantFilter(tenantId),
    }).limit(20);
  }
}

module.exports = SearchRepository;
