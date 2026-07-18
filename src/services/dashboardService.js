const FuncionarioRepository = require('../repositories/FuncionariosRepository');
const Simbologia = require('../models/limitesSimbologiaSchema');
const Funcionario = require('../models/funcionariosSchema');
const mongoose = require('mongoose');

class DashboardService {
  static tenantFilter(tenantId) {
    if (!tenantId) return {};
    return {
      tenantId: mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId,
    };
  }

  static async getSummary(tenantId = null) {
    const filter = this.tenantFilter(tenantId);

    const [headcount, simbologias, ocupadasPorSimbologia, d30, d60, d90] =
      await Promise.all([
        FuncionarioRepository.countByTenant(tenantId),
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
        FuncionarioRepository.countContratosAVencer(30, tenantId),
        FuncionarioRepository.countContratosAVencer(60, tenantId),
        FuncionarioRepository.countContratosAVencer(90, tenantId),
      ]);

    const ocupadasMap = Object.fromEntries(
      ocupadasPorSimbologia.map((r) => [r._id, r.ocupadas])
    );

    const cotasSimbologia = simbologias.map((s) => {
      const disponiveis = s.limite || 0;
      const ocupadas = ocupadasMap[s.simbologia] || 0;
      return {
        simbologia: s.simbologia,
        vagas: disponiveis + ocupadas,
        ocupadas,
        disponiveis,
      };
    });

    return {
      headcount,
      cotasSimbologia,
      contratosAVencer: {
        next30Days: d30,
        next60Days: d60,
        next90Days: d90,
      },
    };
  }
}

module.exports = DashboardService;
