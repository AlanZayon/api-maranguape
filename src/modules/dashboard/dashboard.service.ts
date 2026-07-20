import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DashboardRepository } from './dashboard.repository';
import { SetoresService } from '../setores/setores.service';
import { LimiteSimbologia } from '../funcionarios/schemas/limite-simbologia.schema';
import { SIMBOLOGIA_MODEL } from '../../database/database.module';
import { tenantFilter } from '../../common/utils/tenant.helpers';

type RankedSetor = { id: string; nome: string; total: number };

type SetorNode = {
  _id: unknown;
  nome: string;
  quantidadeFuncionariosSubtree?: number;
  subsetores?: SetorNode[];
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly setoresService: SetoresService,
    @InjectModel(SIMBOLOGIA_MODEL)
    private readonly simbologiaModel: Model<LimiteSimbologia>,
  ) {}

  /**
   * Flatten organized tree into ranking rows using subtree headcount
   * (self + all descendants). A parent with staffed children is not "vazio".
   */
  private flattenEstruturaRanking(
    nodes: SetorNode[],
    acc: RankedSetor[] = [],
  ): RankedSetor[] {
    for (const node of nodes) {
      acc.push({
        id: String(node._id),
        nome: node.nome,
        total: node.quantidadeFuncionariosSubtree || 0,
      });
      if (node.subsetores?.length) {
        this.flattenEstruturaRanking(node.subsetores, acc);
      }
    }
    return acc;
  }

  async getCotasSimbologia(tenantId: string | null = null) {
    const filter = tenantFilter(tenantId);

    const [simbologias, ocupadasMap] = await Promise.all([
      this.simbologiaModel.find(filter).lean(),
      this.dashboardRepository.countOcupadasPorSimbologia(tenantId),
    ]);

    return simbologias.map((s) => {
      const limite = s.limite || 0;
      const ocupadas = ocupadasMap[s.simbologia] || 0;
      const disponiveis = Math.max(0, limite - ocupadas);
      const pct = limite > 0 ? Math.round((ocupadas / limite) * 100) : 0;
      return {
        simbologia: s.simbologia,
        limite,
        vagas: limite,
        ocupadas,
        disponiveis,
        pct,
        estourada: ocupadas > limite,
      };
    });
  }

  async getEstruturaSnapshot(tenantId: string | null = null) {
    const tree = (await this.setoresService.getSetoresOrganizados(
      tenantId,
    )) as unknown as SetorNode[];
    const ranked = this.flattenEstruturaRanking(tree);

    const totalSetores = ranked.length;
    const setoresSemLotacao = ranked.filter((s) => s.total === 0).length;

    ranked.sort((a, b) => b.total - a.total);

    const setoresVazios = ranked
      .filter((s) => s.total === 0)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 8);

    return {
      totalSetores,
      setoresSemLotacao,
      topSetores: ranked.filter((s) => s.total > 0).slice(0, 8),
      setoresVazios,
    };
  }

  async getSummary(tenantId: string | null = null) {
    const [
      headcount,
      byNatureza,
      bySecretaria,
      cotasSimbologia,
      contratosAVencer,
      estrutura,
    ] = await Promise.all([
      this.dashboardRepository.countByTenant(tenantId),
      this.dashboardRepository.groupByField('natureza', tenantId),
      this.dashboardRepository.groupByField('secretaria', tenantId, {
        topN: 10,
      }),
      this.getCotasSimbologia(tenantId),
      this.dashboardRepository.countContratosBuckets(tenantId),
      this.getEstruturaSnapshot(tenantId),
    ]);

    const cotasOcupadas = cotasSimbologia.reduce((s, c) => s + c.ocupadas, 0);
    const cotasLimite = cotasSimbologia.reduce((s, c) => s + c.limite, 0);
    const cotasPct =
      cotasLimite > 0 ? Math.round((cotasOcupadas / cotasLimite) * 100) : 0;

    return {
      headcount,
      byNatureza,
      bySecretaria,
      cotasSimbologia,
      cotasResumo: {
        ocupadas: cotasOcupadas,
        limite: cotasLimite,
        pct: cotasPct,
        estouradas: cotasSimbologia.filter((c) => c.estourada).length,
      },
      contratosAVencer,
      estrutura,
      generatedAt: new Date().toISOString(),
    };
  }

  async getContratos(
    tenantId: string | null = null,
    { withinDays = 90, limit = 20 }: { withinDays?: number; limit?: number } = {},
  ) {
    return this.dashboardRepository.findContratosAVencer(tenantId, {
      withinDays,
      limit,
    });
  }

  async getPayroll(tenantId: string | null = null) {
    return this.dashboardRepository.aggregatePayroll(tenantId);
  }
}
