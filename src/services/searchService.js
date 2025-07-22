const SearchRepository = require('../repositories/searchRepository');

class SearchService {
  static async autocomplete(termo) {
    if (!termo) {
      throw new Error('Termo não informado');
    }

    const funcionarios = await SearchRepository.autocompleteFuncionarios(termo);
    const setores = await SearchRepository.autocompleteSetores(termo);

    // Combina os resultados mantendo a estrutura de nome e tipo
    const todosTermos = [...funcionarios.map(x => x.termo), ...setores.map(x => x.termo)];
    
    // Remove duplicados considerando nome E tipo
    const unicos = todosTermos.filter((item, index, self) =>
      index === self.findIndex((t) => (
        t.nome === item.nome && t.tipo === item.tipo
      ))
    );

    return unicos;
  }

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
        funcionariosIds = [...funcionariosIds, ...funcs.map(f => f._id)];
        setoresInfo.push({
          id: setor._id,
          nome: setor.nome,
          tipo: setor.tipo
        });
      } else {
        const allChildIds = await SearchRepository.findChildIds(setor._id);
        const funcs = await SearchRepository.findFuncionariosByCoordenadoria({ $in: allChildIds });
        funcionariosIds = [...funcionariosIds, ...funcs.map(f => f._id)];
        setoresInfo.push({
          id: setor._id,
          nome: setor.nome,
          tipo: setor.tipo
        });
      }
    }

    const funcionariosDiretos = await SearchRepository.searchFuncionariosDirectly(q);

    const todosIds = [
      ...funcionariosIds,
      ...funcionariosDiretos.map(f => f._id)
    ];

    const idsUnicos = [...new Set(todosIds.map(id => id.toString()))].map(id => new ObjectId(id));

    const resultados = await SearchRepository.getFuncionariosByIds(idsUnicos);

    return {
      funcionarios: resultados,
      setoresEncontrados: setoresInfo
    };
  }
}

module.exports = SearchService;