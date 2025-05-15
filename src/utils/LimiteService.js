const CargoRepository = require('../repositories/cargoComissionadoRepository');

class LimiteService {
  static async atualizarLimitesDeFuncao(
    antigaFuncaoNome,
    novaFuncaoNome,
    antigaNatureza,
    novaNatureza
  ) {
    const [antigaFuncao, novaFuncao] = await Promise.all([
      CargoRepository.buscarPorNome(antigaFuncaoNome),
      CargoRepository.buscarPorNome(novaFuncaoNome),
    ]);

    if (antigaNatureza === 'comissionado') {
      const novoLimite = (antigaFuncao.limite || 0) + 1;
      await CargoRepository.updateLimit(antigaFuncao._id, novoLimite);
    }

    if (novaNatureza === 'comissionado') {
      const novoLimite = (novaFuncao.limite || 0) - 1;
      await CargoRepository.updateLimit(novaFuncao._id, novoLimite);
    }
  }
}

module.exports = LimiteService;
