import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Funcionario, FuncionarioDocument } from '../funcionarios/schemas/funcionario.schema';
import { Setor, SetorDocument } from '../setores/schemas/setor.schema';
import { tenantFilter } from '../../common/utils/tenant.helpers';

/**
 * Data-access layer for search queries against MongoDB models.
 * Ported from legacy/repositories/searchRepository.js.
 */
@Injectable()
export class SearchRepository {
  constructor(
    @InjectModel(Funcionario.name)
    private readonly funcionarioModel: Model<FuncionarioDocument>,
    @InjectModel(Setor.name) private readonly setorModel: Model<SetorDocument>,
  ) {}

  static escapeRegex(str: unknown): string {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static isMissingSearchIndex(error: unknown): boolean {
    const err = error as { code?: number; codeName?: string; message?: string };
    const message = String(err?.message || '');
    return (
      err?.code === 27 ||
      err?.codeName === 'IndexNotFound' ||
      message.includes('text index required') ||
      message.includes('$search') ||
      message.includes('Unrecognized pipeline stage') ||
      message.includes('PlanExecutor error')
    );
  }

  private tenantMatchStage(tenantId: string | null) {
    const filter = tenantFilter(tenantId);
    if (!Object.keys(filter).length) return null;
    return { $match: filter };
  }

  /** Root id + all descendants via a single `$graphLookup`. */
  async findChildIds(parentId: unknown, tenantId: string | null = null) {
    return this.getDescendantIds(parentId, tenantId);
  }

  /**
   * Returns all descendant ids including the root id.
   * Ported from legacy/repositories/SetorRepository.js#getDescendantIds.
   */
  async getDescendantIds(id: unknown, tenantId: string | null = null) {
    const objectId = Types.ObjectId.isValid(String(id))
      ? new Types.ObjectId(String(id))
      : id;

    const match = { _id: objectId, ...tenantFilter(tenantId) };

    const setores = await this.setorModel.aggregate([
      { $match: match },
      {
        $graphLookup: {
          from: 'setors',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent',
          as: 'descendants',
          ...(tenantId ? { restrictSearchWithMatch: tenantFilter(tenantId) } : {}),
        },
      },
    ]);

    if (!setores.length) return [];

    return setores.flatMap((s) => [
      s._id,
      ...s.descendants.map((d: { _id: unknown }) => d._id),
    ]);
  }

  async autocompleteFuncionarios(termo: string, tenantId: string | null = null) {
    const tenantStage = this.tenantMatchStage(tenantId);
    try {
      const pipeline: PipelineStage[] = [
        {
          $search: {
            index: 'autocomplete_funcionarios',
            compound: {
              should: [
                { autocomplete: { query: termo, path: 'nome' } },
                { autocomplete: { query: termo, path: 'funcao' } },
                { autocomplete: { query: termo, path: 'bairro' } },
                { autocomplete: { query: termo, path: 'cidade' } },
                { autocomplete: { query: termo, path: 'natureza' } },
                { autocomplete: { query: termo, path: 'tipo' } },
                { autocomplete: { query: termo, path: 'referencia' } },
              ],
            },
          },
        },
      ];
      if (tenantStage) pipeline.push(tenantStage);
      pipeline.push(
        { $limit: 10 },
        {
          $project: {
            termo: {
              $cond: [
                { $regexMatch: { input: '$nome', regex: termo, options: 'i' } },
                { nome: '$nome', tipo: 'Funcionário' },
                {
                  $cond: [
                    { $regexMatch: { input: '$funcao', regex: termo, options: 'i' } },
                    { nome: '$funcao', tipo: 'Função' },
                    {
                      $cond: [
                        { $regexMatch: { input: '$bairro', regex: termo, options: 'i' } },
                        { nome: '$bairro', tipo: 'Bairro' },
                        {
                          $cond: [
                            { $regexMatch: { input: '$cidade', regex: termo, options: 'i' } },
                            { nome: '$cidade', tipo: 'Cidade' },
                            {
                              $cond: [
                                {
                                  $regexMatch: {
                                    input: '$natureza',
                                    regex: termo,
                                    options: 'i',
                                  },
                                },
                                { nome: '$natureza', tipo: 'Natureza' },
                                {
                                  $cond: [
                                    {
                                      $regexMatch: {
                                        input: '$tipo',
                                        regex: termo,
                                        options: 'i',
                                      },
                                    },
                                    { nome: '$tipo', tipo: 'Tipo' },
                                    { nome: '$referencia', tipo: 'Referência' },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      );
      return await this.funcionarioModel.aggregate(pipeline as any);
    } catch (error) {
      if (!SearchRepository.isMissingSearchIndex(error)) throw error;
      return this.autocompleteFuncionariosRegex(termo, tenantId);
    }
  }

  private async autocompleteFuncionariosRegex(termo: string, tenantId: string | null = null) {
    const regex = new RegExp(SearchRepository.escapeRegex(termo), 'i');
    const funcionarios = await this.funcionarioModel
      .find({
        ...tenantFilter(tenantId),
        $or: [{ nome: regex }, { funcao: regex }, { bairro: regex }, { cidade: regex }],
      })
      .limit(10)
      .select('nome funcao bairro cidade')
      .lean();

    return funcionarios.map((f) => {
      if (regex.test(f.nome || '')) {
        return { termo: { nome: f.nome, tipo: 'Funcionário' } };
      }
      if (regex.test(f.funcao || '')) {
        return { termo: { nome: f.funcao, tipo: 'Função' } };
      }
      if (regex.test(f.bairro || '')) {
        return { termo: { nome: f.bairro, tipo: 'Bairro' } };
      }
      return { termo: { nome: f.cidade, tipo: 'Cidade' } };
    });
  }

  async autocompleteSetores(termo: string, tenantId: string | null = null) {
    const tenantStage = this.tenantMatchStage(tenantId);
    try {
      const pipeline: PipelineStage[] = [
        {
          $search: {
            index: 'autocomplete_setores',
            compound: { should: [{ autocomplete: { query: termo, path: 'nome' } }] },
          },
        },
      ];
      if (tenantStage) pipeline.push(tenantStage);
      pipeline.push(
        { $limit: 10 },
        { $project: { termo: { nome: '$nome', tipo: '$tipo' } } },
      );
      return await this.setorModel.aggregate(pipeline as any);
    } catch (error) {
      if (!SearchRepository.isMissingSearchIndex(error)) throw error;
      const regex = new RegExp(SearchRepository.escapeRegex(termo), 'i');
      const setores = await this.setorModel
        .find({ nome: regex, ...tenantFilter(tenantId) })
        .limit(10)
        .select('nome tipo')
        .lean();
      return setores.map((s) => ({ termo: { nome: s.nome, tipo: s.tipo } }));
    }
  }

  async searchSetores(q: string, tenantId: string | null = null) {
    try {
      return await this.setorModel
        .find(
          { $text: { $search: q }, ...tenantFilter(tenantId) },
          { score: { $meta: 'textScore' }, tipo: 1, nome: 1 },
        )
        .sort({ score: { $meta: 'textScore' } })
        .limit(5)
        .select('_id tipo nome');
    } catch (error) {
      if (!SearchRepository.isMissingSearchIndex(error)) throw error;
      const regex = new RegExp(SearchRepository.escapeRegex(q), 'i');
      return await this.setorModel
        .find({ nome: regex, ...tenantFilter(tenantId) })
        .limit(5)
        .select('_id tipo nome');
    }
  }

  async findFuncionariosBySetorId(setorId: unknown, tenantId: string | null = null) {
    return this.funcionarioModel
      .find({ setorId, ...tenantFilter(tenantId) })
      .select('_id');
  }

  async searchFuncionariosDirectly(q: string, tenantId: string | null = null) {
    const tenantStage = this.tenantMatchStage(tenantId);
    try {
      const pipeline: PipelineStage[] = [
        {
          $search: {
            index: 'busca_geral_funcionarios',
            text: {
              query: q,
              path: ['bairro', 'cidade', 'funcao', 'natureza', 'nome', 'referencia', 'tipo'],
            },
          },
        },
      ];
      if (tenantStage) pipeline.push(tenantStage);
      pipeline.push({ $limit: 20 }, { $project: { _id: 1 } });
      return await this.funcionarioModel.aggregate(pipeline as any);
    } catch (error) {
      if (!SearchRepository.isMissingSearchIndex(error)) throw error;
      const regex = new RegExp(SearchRepository.escapeRegex(q), 'i');
      return await this.funcionarioModel
        .find({
          ...tenantFilter(tenantId),
          $or: [
            { nome: regex },
            { funcao: regex },
            { secretaria: regex },
            { natureza: regex },
            { referencia: regex },
            { bairro: regex },
            { cidade: regex },
          ],
        })
        .limit(20)
        .select('_id');
    }
  }

  async getFuncionariosByIds(ids: Types.ObjectId[], tenantId: string | null = null) {
    return this.funcionarioModel
      .find({ _id: { $in: ids }, ...tenantFilter(tenantId) })
      .limit(20);
  }
}
