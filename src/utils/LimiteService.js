const CargoRepository = require('../repositories/cargoComissionadoRepository');

class LimiteService {
  static async atualizarLimitesDeFuncao(
    antigaFuncaoNome,
    novaFuncaoNome,
    antigaNatureza,
    novaNatureza,
    tenantId = null
  ) {
    const [antigaFuncao, novaFuncao] = await Promise.all([
      CargoRepository.buscarPorNome(antigaFuncaoNome, tenantId),
      CargoRepository.buscarPorNome(novaFuncaoNome, tenantId),
    ]);

    if (antigaNatureza === 'COMISSIONADO' && antigaFuncao?.simbologia) {
      const simbologia = await CargoRepository.buscarPorSimbologia(
        antigaFuncao.simbologia,
        tenantId
      );
      const novoLimite = (simbologia?.limite || 0) + 1;
      await CargoRepository.updateLimite(
        simbologia.simbologia,
        novoLimite,
        tenantId
      );
    }

    if (novaNatureza === 'COMISSIONADO' && novaFuncao?.simbologia) {
      const simbologia = await CargoRepository.buscarPorSimbologia(
        novaFuncao.simbologia,
        tenantId
      );
      const novoLimite = (simbologia?.limite || 0) - 1;
      await CargoRepository.updateLimite(
        simbologia.simbologia,
        novoLimite,
        tenantId
      );
    }
  }
}

module.exports = LimiteService;
