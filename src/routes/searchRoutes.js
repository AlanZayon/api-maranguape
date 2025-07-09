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
          termo: {
            nome: '$nome',
            tipo: '$tipo' // Inclui o tipo do setor (Setor, Subsetor, Coordenadoria)
          },
        },
      },
    ]);

    // Combina os resultados mantendo a estrutura de nome e tipo
    const todosTermos = [...funcionarios.map(x => x.termo), ...setores.map(x => x.termo)];
    
    // Remove duplicados considerando nome E tipo
    const unicos = todosTermos.filter((item, index, self) =>
      index === self.findIndex((t) => (
        t.nome === item.nome && t.tipo === item.tipo
      ))
    );

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
      { score: { $meta: "textScore" }, tipo: 1, nome: 1 }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(5)
      .select('_id tipo nome');

    let funcionariosIds = [];
    let setoresInfo = [];

    for (const setor of setoresEncontrados) {
      if (setor.tipo === 'Coordenadoria') {
        const funcs = await Funcionario.find({ coordenadoria: setor._id }).select('_id');
        funcionariosIds = [...funcionariosIds, ...funcs.map(f => f._id)];
        setoresInfo.push({
          id: setor._id,
          nome: setor.nome,
          tipo: setor.tipo
        });
      } else {
        const allChildIds = await findChildIds(setor._id);
        const funcs = await Funcionario.find({ coordenadoria: { $in: allChildIds } }).select('_id');
        funcionariosIds = [...funcionariosIds, ...funcs.map(f => f._id)];
        setoresInfo.push({
          id: setor._id,
          nome: setor.nome,
          tipo: setor.tipo
        });
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

    // Adiciona informações dos setores encontrados na resposta
    res.json({
      funcionarios: resultados,
      setoresEncontrados: setoresInfo
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar os dados.' });
  }
});

module.exports = router;