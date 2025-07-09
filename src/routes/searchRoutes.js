const express = require('express');
const router = express.Router();
const Funcionario = require('../models/funcionariosSchema');
const Setor = require('../models/setoresSchema');
const { ObjectId } = require('mongodb');

async function findChildIds(parentId) {
  const children = await Setor.find({ parent: parentId });
  let ids = [parentId];

  for (const child of children) {
    const childIds = await findChildIds(child._id);
    ids = [...ids, ...childIds];
  }

  return ids;
}

router.get('/autocomplete', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ error: 'Termo não informado' });

  try {
    const funcionarios = await Funcionario.aggregate([
      {
        $search: {
          index: 'autocomplete_funcionarios',
          compound: {
            should: [
              { autocomplete: { query: termo, path: 'nome' } },
              { autocomplete: { query: termo, path: 'funcao' } },
              { autocomplete: { query: termo, path: 'secretaria' } },
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
              '$nome',
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: '$funcao',
                      regex: termo,
                      options: 'i',
                    },
                  },
                  '$funcao',
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: '$secretaria',
                          regex: termo,
                          options: 'i',
                        },
                      },
                      '$secretaria',
                      {
                        $cond: [
                          {
                            $regexMatch: {
                              input: '$bairro',
                              regex: termo,
                              options: 'i',
                            },
                          },
                          '$bairro',
                          {
                            $cond: [
                              {
                                $regexMatch: {
                                  input: '$cidade',
                                  regex: termo,
                                  options: 'i',
                                },
                              },
                              '$cidade',
                              {
                                $cond: [
                                  {
                                    $regexMatch: {
                                      input: '$natureza',
                                      regex: termo,
                                      options: 'i',
                                    },
                                  },
                                  '$natureza',
                                  {
                                    $cond: [
                                      {
                                        $regexMatch: {
                                          input: '$tipo',
                                          regex: termo,
                                          options: 'i',
                                        },
                                      },
                                      '$tipo',
                                      '$referencia',
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
            ],
          },
        },
      },
    ]);

    const setores = await Setor.aggregate([
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
          termo: '$nome',
        },
      },
    ]);

    const todosTermos = [...funcionarios, ...setores].map((x) => x.termo);
    const unicos = [...new Set(todosTermos)];

    res.json(unicos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar termos' });
  }
});

router.get('/search-funcionarios', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Parâmetro de busca "q" é obrigatório.' });
  }

  try {
    const setoresEncontrados = await Setor.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" }, tipo: 1 }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(5)
      .select('_id tipo');

    let funcionariosIds = [];

    for (const setor of setoresEncontrados) {
      if (setor.tipo === 'Coordenadoria') {
        const funcs = await Funcionario.find({ coordenadoria: setor._id }).select('_id');
        funcionariosIds = [...funcionariosIds, ...funcs.map(f => f._id)];
      } else {
        const allChildIds = await findChildIds(setor._id);
        const funcs = await Funcionario.find({ coordenadoria: { $in: allChildIds } }).select('_id');
        funcionariosIds = [...funcionariosIds, ...funcs.map(f => f._id)];
      }
    }

    const funcionariosDiretos = await Funcionario.aggregate([
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
              'secretaria',
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

    const todosIds = [
      ...funcionariosIds,
      ...funcionariosDiretos.map(f => f._id)
    ];

    const idsUnicos = [...new Set(todosIds.map(id => id.toString()))].map(id => new ObjectId(id));

    const resultados = await Funcionario.find({ _id: { $in: idsUnicos } }).limit(20);

    res.json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar os dados.' });
  }
});

module.exports = router;