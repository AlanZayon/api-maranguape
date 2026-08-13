import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Reference } from './schemas/referencia.schema';
import { Funcionario } from '../funcionarios/schemas/funcionario.schema';
import {
  tenantFilter,
  cacheKey,
  toObjectId,
} from '../../common/utils/tenant.helpers';

export type ReferenceNode = {
  _id: Types.ObjectId;
  name: string;
  cargo?: string;
  telefone?: string;
  origem?: string;
  funcionarioId?: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  depth?: number;
};

export type FuncionarioNode = {
  _id: Types.ObjectId;
  nome: string;
  funcao?: string;
  secretaria?: string;
  natureza?: string;
  referenciaId?: Types.ObjectId | null;
};

const REFERENCE_FIELDS = {
  name: 1,
  cargo: 1,
  telefone: 1,
  origem: 1,
  funcionarioId: 1,
  parentId: 1,
} as const;

/**
 * Projeção para os elementos do array do `$graphLookup`. `_id` precisa ser
 * pedido explicitamente: a inclusão implícita só vale para o documento raiz.
 */
const NESTED_REFERENCE_FIELDS = {
  _id: 1,
  ...REFERENCE_FIELDS,
  depth: 1,
} as const;

const FUNCIONARIO_FIELDS = {
  nome: 1,
  funcao: 1,
  secretaria: 1,
  natureza: 1,
  referenciaId: 1,
} as const;

@Injectable()
export class ReferenciasRepository {
  constructor(
    @InjectModel(Reference.name)
    private readonly referenceModel: Model<Reference>,
    @InjectModel(Funcionario.name)
    private readonly funcionarioModel: Model<Funcionario>,
  ) {}

  cacheKeyFor(tenantId: string | null): string {
    return cacheKey(tenantId, 'referencias-dados');
  }

  treeCacheKeyFor(tenantId: string | null): string {
    return cacheKey(tenantId, 'referencias-arvore');
  }

  async findReferenceByName(name: string, tenantId: string | null = null) {
    return this.referenceModel.findOne({ name, ...tenantFilter(tenantId) });
  }

  async findReferenceByFuncionarioId(
    funcionarioId: string,
    tenantId: string | null = null,
  ) {
    return this.referenceModel.findOne({
      funcionarioId,
      ...tenantFilter(tenantId),
    });
  }

  async findReferenceById(id: string, tenantId: string | null = null) {
    return this.referenceModel.findOne({
      _id: id,
      ...tenantFilter(tenantId),
    });
  }

  async createReference(referenceData: Partial<Reference>) {
    const payload = { ...referenceData } as Record<string, unknown>;
    if (payload.funcionarioId == null) {
      delete payload.funcionarioId;
    }
    const newReference = new this.referenceModel(payload);
    return newReference.save();
  }

  async getAllReferences(tenantId: string | null = null) {
    return this.referenceModel.find(tenantFilter(tenantId)).sort({ name: 1 });
  }

  async updateReferenceById(
    id: string,
    update: Record<string, unknown>,
    tenantId: string | null = null,
  ) {
    return this.referenceModel.findOneAndUpdate(
      { _id: id, ...tenantFilter(tenantId) },
      update,
      { new: true },
    );
  }

  async deleteReferenceById(
    id: string,
    tenantId: string | null = null,
    session?: ClientSession,
  ) {
    return this.referenceModel.findOneAndDelete(
      { _id: id, ...tenantFilter(tenantId) },
      session ? { session } : {},
    );
  }

  /**
   * Cadeia de ancestrais até a raiz, resolvida em uma única query.
   * Retorna do mais distante (raiz) para o pai direto.
   */
  async findAncestors(
    id: string | Types.ObjectId,
    tenantId: string | null = null,
  ): Promise<ReferenceNode[]> {
    const scope = tenantFilter(tenantId);
    const [result] = await this.referenceModel.aggregate<{
      ancestors: ReferenceNode[];
    }>([
      { $match: { _id: toObjectId(id), ...scope } },
      {
        $graphLookup: {
          from: this.referenceModel.collection.name,
          startWith: '$parentId',
          connectFromField: 'parentId',
          connectToField: '_id',
          as: 'ancestors',
          depthField: 'depth',
          ...(Object.keys(scope).length
            ? { restrictSearchWithMatch: scope }
            : {}),
        },
      },
      { $project: { ancestors: NESTED_REFERENCE_FIELDS } },
    ]);

    if (!result) return [];

    return [...result.ancestors].sort(
      (a, b) => (b.depth ?? 0) - (a.depth ?? 0),
    );
  }

  /**
   * Todos os descendentes (referências) em qualquer profundidade, em uma única
   * query, mais os funcionários vinculados a qualquer nó da subárvore.
   */
  async findDescendants(
    id: string | Types.ObjectId,
    tenantId: string | null = null,
  ): Promise<{
    root: ReferenceNode | null;
    referencias: ReferenceNode[];
    funcionarios: FuncionarioNode[];
  }> {
    const scope = tenantFilter(tenantId);
    const [result] = await this.referenceModel.aggregate<
      ReferenceNode & { descendants: ReferenceNode[] }
    >([
      { $match: { _id: toObjectId(id), ...scope } },
      {
        $graphLookup: {
          from: this.referenceModel.collection.name,
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parentId',
          as: 'descendants',
          depthField: 'depth',
          ...(Object.keys(scope).length
            ? { restrictSearchWithMatch: scope }
            : {}),
        },
      },
      {
        $project: {
          ...REFERENCE_FIELDS,
          descendants: NESTED_REFERENCE_FIELDS,
        },
      },
    ]);

    if (!result) {
      return { root: null, referencias: [], funcionarios: [] };
    }

    const { descendants, ...root } = result;
    const subtreeIds = [root._id, ...descendants.map((item) => item._id)];
    const funcionarios = await this.findFuncionariosByReferenciaIds(
      subtreeIds,
      tenantId,
    );

    return { root, referencias: descendants, funcionarios };
  }

  /** Catálogo completo + funcionários indicados, para montar a árvore em memória. */
  async findAllForTree(tenantId: string | null = null): Promise<{
    referencias: ReferenceNode[];
    funcionarios: FuncionarioNode[];
  }> {
    const scope = tenantFilter(tenantId);
    const [referencias, funcionarios] = await Promise.all([
      this.referenceModel
        .find(scope, REFERENCE_FIELDS)
        .sort({ name: 1 })
        .lean<ReferenceNode[]>(),
      this.funcionarioModel
        .find(
          { referenciaId: { $ne: null }, ...scope },
          FUNCIONARIO_FIELDS,
        )
        .sort({ nome: 1 })
        .lean<FuncionarioNode[]>(),
    ]);

    return { referencias, funcionarios };
  }

  async findFuncionariosByReferenciaIds(
    ids: Array<string | Types.ObjectId>,
    tenantId: string | null = null,
  ): Promise<FuncionarioNode[]> {
    if (!ids.length) return [];
    return this.funcionarioModel
      .find(
        {
          referenciaId: { $in: ids.map((id) => toObjectId(id)) },
          ...tenantFilter(tenantId),
        },
        FUNCIONARIO_FIELDS,
      )
      .sort({ nome: 1 })
      .lean<FuncionarioNode[]>();
  }

  async findFuncionarioById(id: string, tenantId: string | null = null) {
    return this.funcionarioModel
      .findOne({ _id: id, ...tenantFilter(tenantId) }, FUNCIONARIO_FIELDS)
      .lean<FuncionarioNode | null>();
  }

  async countDirectChildren(
    id: string | Types.ObjectId,
    tenantId: string | null = null,
  ): Promise<{ referencias: number; funcionarios: number }> {
    const scope = tenantFilter(tenantId);
    const oid = toObjectId(id);
    const [referencias, funcionarios] = await Promise.all([
      this.referenceModel.countDocuments({ parentId: oid, ...scope }),
      this.funcionarioModel.countDocuments({ referenciaId: oid, ...scope }),
    ]);
    return { referencias, funcionarios };
  }

  /** Move os filhos-referência de `fromId` para `toParentId` (`null` = raiz). */
  async reparentChildren(
    fromId: string | Types.ObjectId,
    toParentId: Types.ObjectId | null,
    tenantId: string | null = null,
    session?: ClientSession,
  ) {
    return this.referenceModel.updateMany(
      { parentId: toObjectId(fromId), ...tenantFilter(tenantId) },
      { $set: { parentId: toParentId } },
      session ? { session } : {},
    );
  }

  /** Move os funcionários indicados por `fromId` para `toParent`. */
  async reassignFuncionarios(
    fromId: string | Types.ObjectId,
    toParent: { _id: Types.ObjectId; name: string } | null,
    tenantId: string | null = null,
    session?: ClientSession,
  ) {
    return this.funcionarioModel.updateMany(
      { referenciaId: toObjectId(fromId), ...tenantFilter(tenantId) },
      {
        $set: {
          referenciaId: toParent ? toParent._id : null,
          referencia: toParent ? toParent.name : null,
        },
      },
      session ? { session } : {},
    );
  }

  /** Mantém `funcionario.referencia` coerente quando a referência é renomeada. */
  async renameFuncionariosReferencia(
    referenciaId: string | Types.ObjectId,
    name: string,
    tenantId: string | null = null,
  ) {
    return this.funcionarioModel.updateMany(
      { referenciaId: toObjectId(referenciaId), ...tenantFilter(tenantId) },
      { $set: { referencia: name } },
    );
  }

  startSession(): Promise<ClientSession> {
    return this.referenceModel.db.startSession();
  }
}
