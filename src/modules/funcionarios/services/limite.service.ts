import { Injectable } from '@nestjs/common';
import { CargoLookupRepository } from '../repositories/cargo-lookup.repository';

/**
 * Ported from legacy/utils/LimiteService.js.
 * Adjusts commissioned-position (cargo comissionado) `limite` counters when
 * an employee's função/natureza changes.
 */
@Injectable()
export class LimiteService {
  constructor(private readonly cargoLookup: CargoLookupRepository) {}

  async atualizarLimitesDeFuncao(
    antigaFuncaoNome: string,
    novaFuncaoNome: string,
    antigaNatureza: string | null,
    novaNatureza: string | null,
    tenantId: string | null = null,
  ) {
    const [antigaFuncao, novaFuncao] = await Promise.all([
      this.cargoLookup.buscarPorNome(antigaFuncaoNome, tenantId),
      this.cargoLookup.buscarPorNome(novaFuncaoNome, tenantId),
    ]);

    if (antigaNatureza === 'COMISSIONADO' && antigaFuncao?.simbologia) {
      const simbologia = await this.cargoLookup.buscarPorSimbologia(
        antigaFuncao.simbologia,
        tenantId,
      );
      const novoLimite = (simbologia?.limite || 0) + 1;
      await this.cargoLookup.updateLimite(
        simbologia!.simbologia,
        novoLimite,
        tenantId,
      );
    }

    if (novaNatureza === 'COMISSIONADO' && novaFuncao?.simbologia) {
      const simbologia = await this.cargoLookup.buscarPorSimbologia(
        novaFuncao.simbologia,
        tenantId,
      );
      const novoLimite = (simbologia?.limite || 0) - 1;
      await this.cargoLookup.updateLimite(
        novaFuncao.simbologia,
        novoLimite,
        tenantId,
      );
    }
  }
}
