const FuncionarioRepository = require('../repositories/FuncionariosRepository');
const Simbologia = require('../models/limitesSimbologiaSchema');
const Funcionario = require('../models/funcionariosSchema');
const mongoose = require('mongoose');
const SetorService = require('./SetorService');

class DashboardService {
  static tenantFilter(tenantId) {
    if (!tenantId) return {};
    return {
      tenantId: mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId,
    };
  }

  /**
   * Flatten organized tree into ranking rows using subtree headcount
   * (self + all descendants). A parent with staffed children is not "vazio".
   */
  static flattenEstruturaRanking(nodes, acc = []) {
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

  static async getCotasSimbologia(tenantId = null) {
    const filter = this.tenantFilter(tenantId);

    const [simbologias, ocupadasPorSimbologia] = await Promise.all([
      Simbologia.find(filter).lean(),
      Funcionario.aggregate([
        {
          $match: {
            ...filter,
            natureza: 'COMISSIONADO',
          },
        },
        {
          $lookup: {
            from: 'cargocomissionados',
            localField: 'funcao',
            foreignField: 'cargo',
            as: 'cargoInfo',
          },
        },
        { $unwind: { path: '$cargoInfo', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$cargoInfo.simbologia',
            ocupadas: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ocupadasMap = Object.fromEntries(
      ocupadasPorSimbologia.map((r) => [r._id, r.ocupadas])
    );

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

  static async getEstruturaSnapshot(tenantId = null) {
    const tree = await SetorService.getSetoresOrganizados(tenantId);
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

  static async getSummary(tenantId = null) {
    const [
      headcount,
      byNatureza,
      bySecretaria,
      cotasSimbologia,
      contratosAVencer,
      estrutura,
    ] = await Promise.all([
      FuncionarioRepository.countByTenant(tenantId),
      FuncionarioRepository.groupByField('natureza', tenantId),
      FuncionarioRepository.groupByField('secretaria', tenantId, { topN: 10 }),
      this.getCotasSimbologia(tenantId),
      FuncionarioRepository.countContratosBuckets(tenantId),
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

  static async getContratos(tenantId = null, { withinDays = 90, limit = 20 } = {}) {
    return FuncionarioRepository.findContratosAVencer(tenantId, {
      withinDays,
      limit,
    });
  }

  static async getPayroll(tenantId = null) {
    return FuncionarioRepository.aggregatePayroll(tenantId);
  }
}

module.exports = DashboardService;
