import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Setor } from './schemas/setor.schema';
import { Funcionario } from '../funcionarios/schemas/funcionario.schema';
import { tenantFilter } from '../../common/utils/tenant.helpers';

@Injectable()
export class SetoresRepository {
  constructor(
    @InjectModel(Setor.name) private readonly setorModel: Model<Setor>,
    @InjectModel(Funcionario.name)
    private readonly funcionarioModel: Model<Funcionario>,
  ) {}

  async getAllSetores(tenantId: string | null = null) {
    return this.setorModel.find(tenantFilter(tenantId)).lean();
  }

  async findById(id: string, tenantId: string | null = null) {
    return this.setorModel.findOne({ _id: id, ...tenantFilter(tenantId) });
  }

  async create(data: Partial<Setor>) {
    return new this.setorModel(data).save();
  }

  async findMainSetores(tenantId: string | null = null) {
    return this.setorModel.find({ parent: null, ...tenantFilter(tenantId) });
  }

  /**
   * Direct children of a parent. Pass null/undefined for roots.
   */
  async findChildren(
    parentId: string | null = null,
    tenantId: string | null = null,
  ) {
    const parent =
      parentId === undefined || parentId === null || parentId === ''
        ? null
        : parentId;
    return this.setorModel.find({
      parent,
      ...tenantFilter(tenantId),
    });
  }

  async findSetorData(setorId: string, tenantId: string | null = null) {
    return this.setorModel.find({
      parent: setorId,
      ...tenantFilter(tenantId),
    });
  }

  async updateNome(
    id: string,
    nome: string,
    extra: Record<string, unknown> = {},
    tenantId: string | null = null,
  ) {
    return this.setorModel.findOneAndUpdate(
      { _id: id, ...tenantFilter(tenantId) },
      { nome, ...extra },
      { new: true },
    );
  }

  async updateParent(
    id: string,
    parent: string | null,
    extra: Record<string, unknown> = {},
    tenantId: string | null = null,
  ) {
    return this.setorModel.findOneAndUpdate(
      { _id: id, ...tenantFilter(tenantId) },
      { parent, ...extra },
      { new: true },
    );
  }

  /**
   * Returns all descendant IDs including the root id (does not delete).
   * Matches parent as ObjectId or legacy string.
   */
  async getDescendantIds(
    id: string,
    tenantId: string | null = null,
  ): Promise<Types.ObjectId[]> {
    const objectId = Types.ObjectId.isValid(id)
      ? new Types.ObjectId(id)
      : null;
    if (!objectId) return [];

    const seen = new Set<string>([String(objectId)]);
    let frontier: Types.ObjectId[] = [objectId];

    while (frontier.length) {
      const matchIds = frontier.flatMap((fid) => [fid, String(fid)]);
      const children = await this.setorModel
        .find({
          parent: { $in: matchIds },
          ...tenantFilter(tenantId),
        })
        .select('_id')
        .lean();

      const next: Types.ObjectId[] = [];
      for (const child of children) {
        const key = String(child._id);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(child._id as Types.ObjectId);
      }
      frontier = next;
    }

    return [...seen]
      .filter((sid) => Types.ObjectId.isValid(sid))
      .map((sid) => new Types.ObjectId(sid));
  }

  async deleteWithChildren(
    id: string,
    tenantId: string | null = null,
  ): Promise<{ deletedCount?: number }> {
    const idsParaDeletar = await this.getDescendantIds(id, tenantId);
    if (!idsParaDeletar.length) return { deletedCount: 0 };
    return this.setorModel.deleteMany({
      _id: { $in: idsParaDeletar },
      ...tenantFilter(tenantId),
    });
  }

  /** Counts employees grouped by setorId, keyed by string id. */
  async countFuncionariosPorSetor(
    tenantId: string | null = null,
  ): Promise<Record<string, number>> {
    const filter = tenantFilter(tenantId);
    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(filter).length) {
      pipeline.push({ $match: filter });
    }
    pipeline.push({ $group: { _id: '$setorId', total: { $sum: 1 } } });

    const result = await this.funcionarioModel.aggregate(pipeline as any);

    return result.reduce(
      (acc: Record<string, number>, { _id, total }) => {
        if (_id) acc[String(_id)] = total;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async countFuncionariosInSetores(setorIds: unknown[]): Promise<number> {
    return this.funcionarioModel.countDocuments({
      setorId: { $in: setorIds },
    });
  }
}
