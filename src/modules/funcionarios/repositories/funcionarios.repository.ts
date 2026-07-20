import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Funcionario, FuncionarioDocument } from '../schemas/funcionario.schema';
import { Setor, SetorDocument } from '../../setores/schemas/setor.schema';
import { tenantFilter, idsMatchValues } from '../../../common/utils/tenant.helpers';
import { ListFilters } from '../types/list-filters.type';

const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 50;

/**
 * Ported from legacy/repositories/FuncionariosRepository.js.
 */
@Injectable()
export class FuncionariosRepository {
  constructor(
    @InjectModel(Funcionario.name)
    private readonly funcionarioModel: Model<FuncionarioDocument>,
    @InjectModel(Setor.name)
    private readonly setorModel: Model<SetorDocument>,
  ) {}

  static escapeRegex(str: unknown): string {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  toObjectIds(ids: unknown): Types.ObjectId[] {
    const arr = Array.isArray(ids) ? ids : [ids];
    return arr
      .map((id) =>
        Types.ObjectId.isValid(String(id))
          ? id instanceof Types.ObjectId
            ? id
            : new Types.ObjectId(String(id))
          : null,
      )
      .filter((id): id is Types.ObjectId => id != null);
  }

  /** ObjectId + string forms so legacy string-stored refs still match. */
  toMatchIds(ids: unknown): unknown[] {
    return idsMatchValues(ids);
  }

  /** Shared list/selection filter match. */
  buildListMatch(filters: ListFilters = {}, tenantId: string | null = null) {
    const match: Record<string, unknown> = { ...tenantFilter(tenantId) };
    const { q, natureza, secretaria, funcao, bairro, referencia } = filters;

    if (q && String(q).trim()) {
      const regex = new RegExp(
        FuncionariosRepository.escapeRegex(String(q).trim()),
        'i',
      );
      match.$or = [
        { nome: regex },
        { funcao: regex },
        { secretaria: regex },
        { bairro: regex },
        { cidade: regex },
        { natureza: regex },
        { referencia: regex },
        { telefone: regex },
        { tipo: regex },
      ];
    }

    if (natureza && String(natureza).trim()) {
      match.natureza = new RegExp(
        `^${FuncionariosRepository.escapeRegex(String(natureza).trim())}$`,
        'i',
      );
    }

    if (secretaria && String(secretaria).trim()) {
      match.secretaria = new RegExp(
        `^${FuncionariosRepository.escapeRegex(String(secretaria).trim())}$`,
        'i',
      );
    }

    if (funcao && String(funcao).trim()) {
      match.funcao = new RegExp(
        `^${FuncionariosRepository.escapeRegex(String(funcao).trim())}$`,
        'i',
      );
    }

    if (bairro && String(bairro).trim()) {
      match.bairro = new RegExp(
        `^${FuncionariosRepository.escapeRegex(String(bairro).trim())}$`,
        'i',
      );
    }

    if (referencia && String(referencia).trim()) {
      match.referencia = new RegExp(
        `^${FuncionariosRepository.escapeRegex(String(referencia).trim())}$`,
        'i',
      );
    }

    return match;
  }

  async findByName(name: string, tenantId: string | null = null) {
    return this.funcionarioModel.findOne({
      nome: name,
      ...tenantFilter(tenantId),
    });
  }

  findByIds(userIds: string | string[], tenantId: string | null = null) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    return this.funcionarioModel
      .find({ _id: { $in: ids }, ...tenantFilter(tenantId) })
      .lean();
  }

  findById(id: string, tenantId: string | null = null) {
    return this.funcionarioModel
      .findOne({ _id: id, ...tenantFilter(tenantId) })
      .lean();
  }

  async countParaSelecao(filters: ListFilters = {}, tenantId: string | null = null) {
    return this.funcionarioModel.countDocuments(
      this.buildListMatch(filters, tenantId),
    );
  }

  findParaSelecao(
    filters: ListFilters = {},
    skip = 0,
    limit = 15,
    tenantId: string | null = null,
  ) {
    return this.funcionarioModel
      .find(this.buildListMatch(filters, tenantId))
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .select('nome funcao secretaria natureza telefone tipo referencia bairro cidade')
      .lean();
  }

  async distinctFiltrosSelecao(tenantId: string | null = null) {
    const filter = tenantFilter(tenantId);
    const [naturezas, secretarias, funcoes, bairros, referencias] =
      await Promise.all([
        this.funcionarioModel.distinct('natureza', filter),
        this.funcionarioModel.distinct('secretaria', filter),
        this.funcionarioModel.distinct('funcao', filter),
        this.funcionarioModel.distinct('bairro', filter),
        this.funcionarioModel.distinct('referencia', filter),
      ]);

    const cleanSort = (arr: unknown[]) =>
      arr
        .filter((v) => v != null && String(v).trim() !== '')
        .map(String)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return {
      naturezas: cleanSort(naturezas),
      secretarias: cleanSort(secretarias),
      funcoes: cleanSort(funcoes),
      bairros: cleanSort(bairros),
      referencias: cleanSort(referencias),
    };
  }

  async countWithFilters(filters: ListFilters = {}, tenantId: string | null = null) {
    return this.funcionarioModel.countDocuments(
      this.buildListMatch(filters, tenantId),
    );
  }

  findWithFilters(
    filters: ListFilters = {},
    skip = 0,
    limit = 50,
    tenantId: string | null = null,
  ) {
    return this.funcionarioModel
      .find(this.buildListMatch(filters, tenantId))
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  findBySetoresFiltered(
    idsSetores: unknown[],
    skip: number,
    limit: number,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ) {
    const matchIds = this.toMatchIds(idsSetores);
    const match = {
      ...this.buildListMatch(filters, tenantId),
      setorId: { $in: matchIds },
    };
    return this.funcionarioModel
      .find(match)
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countBySetoresExact(
    idsSetores: unknown[],
    tenantId: string | null = null,
    filters: ListFilters = {},
  ) {
    const matchIds = this.toMatchIds(idsSetores);
    if (!matchIds.length) return 0;
    const match = {
      ...this.buildListMatch(filters, tenantId),
      setorId: { $in: matchIds },
    };
    return this.funcionarioModel.countDocuments(match);
  }

  /** Returns only `_id` for select-all-filtered without loading full docs. */
  async findIdsOnly(
    filters: ListFilters = {},
    tenantId: string | null = null,
    {
      setorIds = null,
      subtreeRoot = null,
      max = 10000,
    }: { setorIds?: unknown[] | null; subtreeRoot?: unknown; max?: number } = {},
  ) {
    let match = this.buildListMatch(filters, tenantId);
    if (subtreeRoot) {
      const ids = await this.getDescendantSetorIds(subtreeRoot, tenantId);
      if (!ids.length) return [];
      match = { ...match, setorId: { $in: this.toMatchIds(ids) } };
    } else if (setorIds && setorIds.length) {
      match = { ...match, setorId: { $in: this.toMatchIds(setorIds) } };
    }
    const docs = await this.funcionarioModel
      .find(match)
      .select('_id')
      .limit(max)
      .lean();
    return docs.map((d) => d._id);
  }

  create(data: Record<string, unknown>) {
    return new this.funcionarioModel(data).save();
  }

  async update(
    id: string,
    data: Record<string, unknown>,
    tenantId: string | null = null,
  ) {
    return this.funcionarioModel.findOneAndUpdate(
      { _id: id, ...tenantFilter(tenantId) },
      data,
      { new: true },
    );
  }

  async deleteBatch(
    userIds: string[],
    tenantId: string | null = null,
  ): Promise<{ deletedCount?: number }> {
    return this.funcionarioModel.deleteMany({
      _id: { $in: userIds },
      ...tenantFilter(tenantId),
    });
  }

  async updateSetorId(
    userIds: string[],
    newSetorId: string,
    tenantId: string | null = null,
  ) {
    const ids = this.toObjectIds(userIds);
    const setorId = this.toObjectIds(newSetorId)[0];

    await this.funcionarioModel.updateMany(
      { _id: { $in: ids }, ...tenantFilter(tenantId) },
      { $set: { setorId } },
    );
  }

  async updateObservacoes(
    userId: string,
    observacoes: unknown[],
    tenantId: string | null = null,
  ) {
    return this.funcionarioModel.findOneAndUpdate(
      { _id: userId, ...tenantFilter(tenantId) },
      { observacoes },
      { new: true },
    );
  }

  /**
   * Collects unique setor ids for the given roots including all
   * descendants. Walks the tree iteratively matching `parent` as both
   * ObjectId and string (legacy Nest writes mixed types).
   */
  async getDescendantSetorIds(
    idsSetores: unknown,
    tenantId: string | null = null,
  ): Promise<Types.ObjectId[]> {
    const roots = this.toObjectIds(idsSetores);
    if (!roots.length) return [];

    const seen = new Set<string>(roots.map((id) => String(id)));
    let frontier: Types.ObjectId[] = roots;

    while (frontier.length) {
      const children = await this.setorModel
        .find({
          parent: { $in: this.toMatchIds(frontier) },
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
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
  }

  /** Count employees under setor roots including descendants (no double-count). */
  async countBySetor(
    idsSetores: unknown,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ) {
    const setorIds = await this.getDescendantSetorIds(idsSetores, tenantId);
    if (!setorIds.length) return 0;

    const match = {
      ...this.buildListMatch(filters, tenantId),
      setorId: { $in: this.toMatchIds(setorIds) },
    };
    return this.funcionarioModel.countDocuments(match);
  }

  /** Paginated employees under a setor subtree. */
  async buscarFuncionariosPorSetor(
    idSetor: unknown,
    skip = 0,
    limit = 50,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ) {
    const setorIds = await this.getDescendantSetorIds(idSetor, tenantId);
    if (!setorIds.length) return [];

    const match = {
      ...this.buildListMatch(filters, tenantId),
      setorId: { $in: this.toMatchIds(setorIds) },
    };

    return this.funcionarioModel
      .find(match)
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async findForExport(tenantId: string | null = null, ids: string[] | null = null) {
    const filter: Record<string, unknown> = { ...tenantFilter(tenantId) };
    if (Array.isArray(ids) && ids.length > 0) {
      filter._id = { $in: ids };
    }
    return this.funcionarioModel
      .find(filter)
      .select('nome secretaria funcao natureza referencia salarioBruto')
      .lean();
  }

  async countByTenant(tenantId: string | null = null) {
    return this.funcionarioModel.countDocuments(tenantFilter(tenantId));
  }
}

export { MAX_LIST_LIMIT, DEFAULT_LIST_LIMIT };
