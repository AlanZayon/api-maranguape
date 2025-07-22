const Funcionario = require('../models/funcionariosSchema');
const Setor = require('../models/setoresSchema');
const { ObjectId } = require('mongodb');

class SearchRepository {
  static async findChildIds(parentId) {
    const children = await Setor.find({ parent: parentId });
    let ids = [parentId];

    for (const child of children) {
      const childIds = await this.findChildIds(child._id);
      ids = [...ids, ...childIds];
    }

    return ids;
  }

  static async autocompleteFuncionarios(termo) {
    return await Funcionario.aggregate([
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
      },
    ]);
  }

  static async autocompleteSetores(termo) {
    return await Setor.aggregate([
      {
        $search: {
          index: 'autocomplete_setores',
          compound: {
            should: [{ autocomplete: { query: termo, path: 'nome' } }],
          },
        },
      },
      { $limit: 10 },
      {
        $project: {
          termo: {
            nome: '$nome',
            tipo: '$tipo'
          },
        },
      },
    ]);
  }

  static async searchSetores(q) {
    return await Setor.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" }, tipo: 1, nome: 1 }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(5)
      .select('_id tipo nome');
  }

  static async findFuncionariosByCoordenadoria(coordenadoriaId) {
    return await Funcionario.find({ coordenadoria: coordenadoriaId }).select('_id');
  }

  static async searchFuncionariosDirectly(q) {
    return await Funcionario.aggregate([
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
      { $limit: 20 },
      {
        $project: {
          _id: 1
        }
      }
    ]);
  }

  static async getFuncionariosByIds(ids) {
    return await Funcionario.find({ _id: { $in: ids } }).limit(20);
  }
}

module.exports = SearchRepository;