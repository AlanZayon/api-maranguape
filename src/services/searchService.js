/**
 * Service layer for search operations on Funcionarios and Setores.
 */
const SearchRepository = require('../repositories/searchRepository');
const { ObjectId } = require('mongodb');
const awsUtils = require('../utils/awsUtils');

/**
 * Provides high-level search capabilities used by controllers.
 */
class SearchService {
  static async autocomplete(termo, tenantId = null) {
    if (!termo) {
      throw new Error('Termo não informado');
    }

    const funcionarios = await SearchRepository.autocompleteFuncionarios(
      termo,
      tenantId
    );
    const setores = await SearchRepository.autocompleteSetores(termo, tenantId);

    const todosTermos = [
      ...funcionarios.map((x) => x.termo),
      ...setores.map((x) => x.termo),
    ];

    const unicos = todosTermos.filter(
      (item, index, self) =>
        index ===
        self.findIndex((t) => t.nome === item.nome && t.tipo === item.tipo)
    );

    return unicos;
  }

  static async searchFuncionarios(q, tenantId = null) {
    if (!q) {
      throw new Error('Parâmetro de busca "q" é obrigatório.');
    }

    const setoresEncontrados = await SearchRepository.searchSetores(
      q,
      tenantId
    );

    let funcionariosIds = [];
    let setoresInfo = [];

    for (const setor of setoresEncontrados) {
      const allChildIds = await SearchRepository.findChildIds(
        setor._id,
        tenantId
      );
      const idsToMatch = [setor._id, ...allChildIds];
      const funcs = await SearchRepository.findFuncionariosBySetorId(
        { $in: idsToMatch },
        tenantId
      );
      funcionariosIds.push(...funcs.map((f) => f._id));

      setoresInfo.push({
        id: setor._id,
        nome: setor.nome,
        tipo: setor.tipo,
      });
    }

    const funcionariosDiretos =
      await SearchRepository.searchFuncionariosDirectly(q, tenantId);

    const todosIds = [
      ...funcionariosIds,
      ...funcionariosDiretos.map((f) => f._id),
    ];

    const idsUnicos = [...new Set(todosIds.map((id) => id.toString()))].map(
      (id) => new ObjectId(id)
    );

    const resultados =
      idsUnicos.length > 0
        ? await SearchRepository.getFuncionariosByIds(idsUnicos, tenantId)
        : [];

    const funcionariosComMidias = await Promise.all(
      resultados.map(async (funcionario) => {
        const base =
          typeof funcionario.toObject === 'function'
            ? funcionario.toObject()
            : funcionario;

        const fotoUrl = base.foto
          ? await awsUtils.gerarUrlPreAssinada(base.foto)
          : null;

        const arquivoUrl = base.arquivo
          ? await awsUtils.gerarUrlPreAssinada(base.arquivo)
          : null;

        return {
          ...base,
          fotoUrl,
          arquivoUrl,
        };
      })
    );

    return {
      funcionarios: funcionariosComMidias,
      setoresEncontrados: setoresInfo,
    };
  }
}

module.exports = SearchService;
