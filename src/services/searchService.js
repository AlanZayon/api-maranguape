/**
 * Service layer for search operations on Funcionarios and Setores.
 * Encapsulates business rules on top of repository/data-access queries.
 */
const SearchRepository = require('../repositories/searchRepository');
const { ObjectId } = require('mongodb');
const awsUtils = require('../utils/awsUtils');

/**
 * Provides high-level search capabilities used by controllers.
 */
class SearchService {
  /**
   * Build autocomplete suggestions for terms across funcionarios and setores.
   *
   * Validates input and aggregates suggestions from multiple sources, then
   * returns unique term/type pairs.
   *
   * @param {string} termo Free-text input to match (required).
   * @returns {Promise<Array<{nome: string, tipo: string}>>} Unique suggestions.
   * @throws {Error} If termo is missing.
   */
  static async autocomplete(termo) {
    if (!termo) {
      throw new Error('Termo não informado');
    }

    const funcionarios = await SearchRepository.autocompleteFuncionarios(termo);
    const setores = await SearchRepository.autocompleteSetores(termo);

    const todosTermos = [...funcionarios.map(x => x.termo), ...setores.map(x => x.termo)];

    // Deduplicate suggestions by (nome, tipo) to avoid repeated terms from different sources
    const unicos = todosTermos.filter((item, index, self) =>
      index === self.findIndex((t) => (
        t.nome === item.nome && t.tipo === item.tipo
      ))
    );

    return unicos;
  }

  /**
   * Search funcionarios by text and by setor hierarchy.
   *
   * - Finds setores matching the query and collects funcionarios under them
   *   (including descendants when needed).
   * - Also adds direct funcionario text matches.
   * - De-duplicates IDs and returns enriched result set.
   *
   * @param {string} q Free-text query (required).
   * @returns {Promise<{ funcionarios: Array<object>, setoresEncontrados: Array<{id: any, nome: string, tipo: string}> }>}
   * @throws {Error} If q is missing.
   */
  static async searchFuncionarios(q) {
    if (!q) {
      throw new Error('Parâmetro de busca "q" é obrigatório.');
    }

    const setoresEncontrados = await SearchRepository.searchSetores(q);

    let funcionariosIds = [];
    let setoresInfo = [];

    for (const setor of setoresEncontrados) {
      if (setor.tipo === 'Coordenadoria') {
        const funcs = await SearchRepository.findFuncionariosByCoordenadoria(setor._id);
        funcionariosIds.push(...funcs.map(f => f._id));
      } else {
        const allChildIds = await SearchRepository.findChildIds(setor._id);
        const funcs = await SearchRepository.findFuncionariosByCoordenadoria({ $in: allChildIds });
        funcionariosIds.push(...funcs.map(f => f._id));
      }

      setoresInfo.push({
        id: setor._id,
        nome: setor.nome,
        tipo: setor.tipo
      });
    }

    const funcionariosDiretos = await SearchRepository.searchFuncionariosDirectly(q);

    const todosIds = [
      ...funcionariosIds,
      ...funcionariosDiretos.map(f => f._id)
    ];

    const idsUnicos = [...new Set(todosIds.map(id => id.toString()))]
      .map(id => new ObjectId(id));

    const resultados = await SearchRepository.getFuncionariosByIds(idsUnicos);

    // 🔥 AQUI GERAMOS AS URLs PRE-ASSINADAS
    const funcionariosComMidias = await Promise.all(
      resultados.map(async funcionario => {
        const fotoUrl = funcionario.foto
          ? await awsUtils.gerarUrlPreAssinada(funcionario.foto)
          : null;

        const arquivoUrl = funcionario.arquivo
          ? await awsUtils.gerarUrlPreAssinada(funcionario.arquivo)
          : null;

        return {
          ...funcionario.toObject(),
          fotoUrl,
          arquivoUrl,
        };
      })
    );

    return {
      funcionarios: funcionariosComMidias,
      setoresEncontrados: setoresInfo
    };
  }
}

module.exports = SearchService;