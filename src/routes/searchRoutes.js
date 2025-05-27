const express = require('express');
const router = express.Router();
const Funcionario = require('../models/funcionariosSchema');
const Setor = require('../models/setoresSchema');

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

    // Juntar os termos únicos
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
    return res
      .status(400)
      .json({ error: 'Parâmetro de busca "q" é obrigatório.' });
  }

  try {
    const results = await Funcionario.aggregate([
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
    ]);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar os dados.' });
  }
});

module.exports = router;
