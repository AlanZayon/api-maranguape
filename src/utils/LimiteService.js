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

    if (antigaNatureza === 'COMISSIONADO') {
      const simbologia = await CargoRepository.buscarPorSimbologia(
        antigaFuncao.simbologia
      );
      const novoLimite = (simbologia?.limite || 0) + 1;
      await CargoRepository.updateLimite(simbologia.simbologia, novoLimite);
    }

    if (novaNatureza === 'COMISSIONADO') {
      const simbologia = await CargoRepository.buscarPorSimbologia(
        novaFuncao.simbologia
      );
      const novoLimite = (simbologia?.limite || 0) - 1;
      await CargoRepository.updateLimite(simbologia.simbologia, novoLimite);
    }
  }
}

module.exports = LimiteService;
