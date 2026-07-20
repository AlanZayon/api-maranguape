import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Funcionario } from '../funcionarios/schemas/funcionario.schema';
import { tenantFilter } from '../../common/utils/tenant.helpers';

export type ContratoBuckets = {
  in30: number;
  in31to60: number;
  in61to90: number;
  expired: number;
  indeterminado: number;
};

@Injectable()
export class DashboardRepository {
  constructor(
    @InjectModel(Funcionario.name)
    private readonly funcionarioModel: Model<Funcionario>,
  ) {}

  async countByTenant(tenantId: string | null = null): Promise<number> {
    return this.funcionarioModel.countDocuments(tenantFilter(tenantId));
  }

  async groupByField(
    field: string,
    tenantId: string | null = null,
    { topN }: { topN?: number | null } = {},
  ) {
    const pipeline: Record<string, unknown>[] = [
      { $match: tenantFilter(tenantId) },
      {
        $group: {
          _id: { $ifNull: [`$${field}`, 'Não informada'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ];
    if (topN) pipeline.push({ $limit: topN });

    const rows = await this.funcionarioModel.aggregate(pipeline as any);
    return rows.map((r) => ({ [field]: r._id || 'Não informada', count: r.count }));
  }

  async countContratosBuckets(
    tenantId: string | null = null,
  ): Promise<ContratoBuckets> {
    const now = new Date();
    const d30 = new Date(now);
    d30.setDate(d30.getDate() + 30);
    const d60 = new Date(now);
    d60.setDate(d60.getDate() + 60);
    const d90 = new Date(now);
    d90.setDate(d90.getDate() + 90);

    const filter = tenantFilter(tenantId);
    const [row] = await this.funcionarioModel.aggregate([
      { $match: filter },
      {
        $facet: {
          in30: [
            {
              $match: { fimContrato: { $type: 'date', $gte: now, $lte: d30 } },
            },
            { $count: 'n' },
          ],
          in31to60: [
            {
              $match: { fimContrato: { $type: 'date', $gt: d30, $lte: d60 } },
            },
            { $count: 'n' },
          ],
          in61to90: [
            {
              $match: { fimContrato: { $type: 'date', $gt: d60, $lte: d90 } },
            },
            { $count: 'n' },
          ],
          expired: [
            { $match: { fimContrato: { $type: 'date', $lt: now } } },
            { $count: 'n' },
          ],
          indeterminado: [
            { $match: { fimContrato: 'indeterminado' } },
            { $count: 'n' },
          ],
        },
      },
    ]);

    const countOf = (bucket: { n?: number }[] | undefined) =>
      bucket?.[0]?.n || 0;

    return {
      in30: countOf(row?.in30),
      in31to60: countOf(row?.in31to60),
      in61to90: countOf(row?.in61to90),
      expired: countOf(row?.expired),
      indeterminado: countOf(row?.indeterminado),
    };
  }

  async findContratosAVencer(
    tenantId: string | null = null,
    { withinDays = 90, limit = 20 }: { withinDays?: number; limit?: number } = {},
  ) {
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + withinDays);

    const docs = await this.funcionarioModel
      .find({
        ...tenantFilter(tenantId),
        fimContrato: { $type: 'date', $gte: now, $lte: until },
      })
      .select('nome natureza secretaria setorId fimContrato')
      .sort({ fimContrato: 1 })
      .limit(limit)
      .lean();

    const msPerDay = 1000 * 60 * 60 * 24;
    return docs.map((doc) => {
      const fim = new Date(doc.fimContrato as unknown as string);
      const diasRestantes = Math.max(
        0,
        Math.ceil((fim.getTime() - now.getTime()) / msPerDay),
      );
      return {
        _id: doc._id,
        nome: doc.nome,
        natureza: doc.natureza,
        secretaria: doc.secretaria,
        setorId: doc.setorId,
        fimContrato: doc.fimContrato,
        diasRestantes,
      };
    });
  }

  async aggregatePayroll(
    tenantId: string | null = null,
    { topSecretarias = 10 }: { topSecretarias?: number } = {},
  ) {
    const filter = tenantFilter(tenantId);
    const salarioExpr = {
      $convert: {
        input: '$salarioBruto',
        to: 'double',
        onError: 0,
        onNull: 0,
      },
    };

    const [totals, byNatureza, bySecretaria] = await Promise.all([
      this.funcionarioModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: salarioExpr },
            media: { $avg: salarioExpr },
            count: { $sum: 1 },
          },
        },
      ]),
      this.funcionarioModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ['$natureza', 'Não informada'] },
            total: { $sum: salarioExpr },
            media: { $avg: salarioExpr },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      this.funcionarioModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ['$secretaria', 'Não informada'] },
            total: { $sum: salarioExpr },
            media: { $avg: salarioExpr },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: topSecretarias },
      ]),
    ]);

    const t = totals[0] || { total: 0, media: 0, count: 0 };
    return {
      total: t.total || 0,
      media: t.media || 0,
      count: t.count || 0,
      byNatureza: byNatureza.map((r) => ({
        natureza: r._id,
        total: r.total,
        media: r.media,
        count: r.count,
      })),
      bySecretaria: bySecretaria.map((r) => ({
        secretaria: r._id,
        total: r.total,
        media: r.media,
        count: r.count,
      })),
    };
  }

  /** Employee counts per simbologia for COMISSIONADO staff, joined against cargocomissionados. */
  async countOcupadasPorSimbologia(
    tenantId: string | null = null,
  ): Promise<Record<string, number>> {
    const filter = tenantFilter(tenantId);
    const rows = await this.funcionarioModel.aggregate([
      { $match: { ...filter, natureza: 'COMISSIONADO' } },
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
    ]);

    return Object.fromEntries(rows.map((r) => [r._id, r.ocupadas]));
  }
}
