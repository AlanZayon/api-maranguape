import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { ReferenciasRepository } from './referencias.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { Funcionario } from '../funcionarios/schemas/funcionario.schema';
import { tenantFilter, toObjectId } from '../../common/utils/tenant.helpers';
import { RegisterReferenceDto } from './dto/register-reference.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import {
  buildTree,
  funcionarioToNode,
  referenceToNode,
  TreeNode,
} from './utils/tree.builder';

/**
 * Transações exigem replica set; o ambiente padrão (docker-compose) roda um
 * mongod standalone. Nesses casos a operação cai no caminho sequencial, que é
 * ordenado para nunca deixar a árvore quebrada em caso de falha parcial.
 */
function isTransactionUnsupported(error: unknown): boolean {
  const err = error as { code?: number; codeName?: string; message?: string };
  const message = String(err?.message || '');
  return (
    err?.code === 20 ||
    err?.codeName === 'IllegalOperation' ||
    /replica set|Transaction numbers|transactions are not supported/i.test(
      message,
    )
  );
}

@Injectable()
export class ReferenciasService {
  constructor(
    private readonly referenciasRepository: ReferenciasRepository,
    private readonly cacheService: CacheService,
    @InjectModel(Funcionario.name)
    private readonly funcionarioModel: Model<Funcionario>,
  ) {}

  async registerReference(
    payload: RegisterReferenceDto = {},
    tenantId: string | null = null,
    userId: string | null = null,
  ) {
    const { funcionarioId, name, cargo, telefone, parentId } = payload;

    if (funcionarioId) {
      return this.registerFromFuncionario(
        funcionarioId,
        tenantId,
        userId,
        parentId,
      );
    }

    return this.registerExterna(
      { name, cargo, telefone, parentId },
      tenantId,
      userId,
    );
  }

  async registerFromFuncionario(
    funcionarioId: string,
    tenantId: string | null = null,
    userId: string | null = null,
    parentId?: string | null,
  ) {
    const funcionario = await this.funcionarioModel
      .findOne({ _id: funcionarioId, ...tenantFilter(tenantId) })
      .lean();
    if (!funcionario) {
      throw new Error('Funcionário não encontrado!');
    }

    const alreadyLinked =
      await this.referenciasRepository.findReferenceByFuncionarioId(
        funcionarioId,
        tenantId,
      );
    if (alreadyLinked) {
      throw new Error('Este funcionário já está cadastrado como referência!');
    }

    const name = String(funcionario.nome || '')
      .trim()
      .toUpperCase();
    if (!name) {
      throw new Error('Funcionário sem nome válido!');
    }

    const existingByName = await this.referenciasRepository.findReferenceByName(
      name,
      tenantId,
    );
    if (existingByName) {
      throw new Error('Já existe uma referência com este nome!');
    }

    const parent = await this.resolveParent(parentId, tenantId);

    const newReference = await this.referenciasRepository.createReference({
      name,
      cargo: (funcionario.funcao || '').toUpperCase() || undefined,
      telefone: funcionario.telefone?.trim() || undefined,
      origem: 'funcionario',
      funcionarioId: funcionario._id,
      parentId: parent ? parent._id : null,
      tenantId: toObjectId(tenantId) as never,
      createdBy: toObjectId(userId) as never,
    });

    await this.cacheService.bumpVersion(tenantId);
    return newReference;
  }

  async registerExterna(
    {
      name,
      cargo,
      telefone,
      parentId,
    }: {
      name?: string;
      cargo?: string;
      telefone?: string;
      parentId?: string | null;
    },
    tenantId: string | null = null,
    userId: string | null = null,
  ) {
    if (!name) {
      throw new Error('Todos os campos são obrigatórios!');
    }

    const normalizedName = String(name).trim().toUpperCase();
    const normalizedCargo = cargo?.toUpperCase();
    const normalizedTelefone = telefone?.trim();

    const existingReference = await this.referenciasRepository.findReferenceByName(
      normalizedName,
      tenantId,
    );
    if (existingReference) {
      throw new Error('Já existe uma referência com este nome e sobrenome!');
    }

    const parent = await this.resolveParent(parentId, tenantId);

    // Do not set funcionarioId (even as null) — unique index is partial on ObjectId.
    const newReference = await this.referenciasRepository.createReference({
      name: normalizedName,
      cargo: normalizedCargo,
      telefone: normalizedTelefone,
      origem: 'externa',
      parentId: parent ? parent._id : null,
      tenantId: toObjectId(tenantId) as never,
      createdBy: toObjectId(userId) as never,
    });

    await this.cacheService.bumpVersion(tenantId);
    return newReference;
  }

  async getReferences(tenantId: string | null = null) {
    const key = this.referenciasRepository.cacheKeyFor(tenantId);
    return this.cacheService.getOrSetCache(key, async () => {
      return this.referenciasRepository.getAllReferences(tenantId);
    });
  }

  /** Árvore completa do tenant, montada a partir de duas leituras. */
  async getTree(tenantId: string | null = null): Promise<TreeNode[]> {
    const key = this.referenciasRepository.treeCacheKeyFor(tenantId);
    return this.cacheService.getOrSetCache(key, async () => {
      const { referencias, funcionarios } =
        await this.referenciasRepository.findAllForTree(tenantId);
      return buildTree(referencias, funcionarios);
    });
  }

  /** Cadeia de ancestrais de uma referência, da raiz até ela própria. */
  async getAncestors(id: string, tenantId: string | null = null) {
    const reference = await this.referenciasRepository.findReferenceById(
      id,
      tenantId,
    );
    if (!reference) {
      throw new Error('Referência não encontrada!');
    }

    const ancestors = await this.referenciasRepository.findAncestors(
      id,
      tenantId,
    );
    const cadeia = [...ancestors, reference.toObject()].map(referenceToNode);

    return { cadeia, raiz: cadeia[0], alvo: cadeia[cadeia.length - 1] };
  }

  /** Subárvore completa (referências em qualquer nível + funcionários folha). */
  async getDescendants(id: string, tenantId: string | null = null) {
    const { root, referencias, funcionarios } =
      await this.referenciasRepository.findDescendants(id, tenantId);
    if (!root) {
      throw new Error('Referência não encontrada!');
    }

    const [arvore] = buildTree(
      [root, ...referencias],
      funcionarios,
      String(root._id),
    );
    return { arvore };
  }

  /** Cadeia de indicação de um funcionário: raiz -> ... -> referência -> funcionário. */
  async getFuncionarioChain(
    funcionarioId: string,
    tenantId: string | null = null,
  ) {
    const funcionario = await this.referenciasRepository.findFuncionarioById(
      funcionarioId,
      tenantId,
    );
    if (!funcionario) {
      throw new Error('Funcionário não encontrado!');
    }

    const alvo = funcionarioToNode(funcionario);
    if (!funcionario.referenciaId) {
      return { cadeia: [alvo], raiz: null, alvo };
    }

    const [ancestors, referencia] = await Promise.all([
      this.referenciasRepository.findAncestors(
        funcionario.referenciaId,
        tenantId,
      ),
      this.referenciasRepository.findReferenceById(
        String(funcionario.referenciaId),
        tenantId,
      ),
    ]);

    if (!referencia) {
      return { cadeia: [alvo], raiz: null, alvo };
    }

    const cadeia = [
      ...[...ancestors, referencia.toObject()].map(referenceToNode),
      alvo,
    ];
    return { cadeia, raiz: cadeia[0], alvo };
  }

  /** Dados de apoio para o diálogo de exclusão: quem herda os filhos e quantos são. */
  async getDeletionImpact(id: string, tenantId: string | null = null) {
    const reference = await this.referenciasRepository.findReferenceById(
      id,
      tenantId,
    );
    if (!reference) {
      throw new Error('Referência não encontrada!');
    }

    const [{ referencias, funcionarios }, parent] = await Promise.all([
      this.referenciasRepository.countDirectChildren(id, tenantId),
      reference.parentId
        ? this.referenciasRepository.findReferenceById(
            String(reference.parentId),
            tenantId,
          )
        : Promise.resolve(null),
    ]);

    return {
      referencia: referenceToNode(reference.toObject()),
      novoParent: parent
        ? { id: String(parent._id), name: parent.name }
        : null,
      filhos: { referencias, funcionarios },
    };
  }

  /**
   * Impede que uma referência aponte para si mesma ou para um descendente.
   * Uma única consulta de ancestrais cobre qualquer profundidade.
   */
  private async assertNoCycle(
    id: string,
    newParentId: string,
    tenantId: string | null = null,
  ) {
    if (String(id) === String(newParentId)) {
      throw new Error('Uma referência não pode indicar a si mesma!');
    }

    const parentAncestors = await this.referenciasRepository.findAncestors(
      newParentId,
      tenantId,
    );
    const createsCycle = parentAncestors.some(
      (ancestor) => String(ancestor._id) === String(id),
    );
    if (createsCycle) {
      throw new Error(
        'Ciclo detectado: a referência não pode ser indicada por um de seus descendentes!',
      );
    }
  }

  private async resolveParent(
    parentId: string | null | undefined,
    tenantId: string | null = null,
  ) {
    if (!parentId) return null;
    const parent = await this.referenciasRepository.findReferenceById(
      parentId,
      tenantId,
    );
    if (!parent) {
      throw new Error('Referência indicadora não encontrada!');
    }
    return parent;
  }

  async updateReference(
    id: string,
    payload: UpdateReferenceDto = {},
    tenantId: string | null = null,
    userId: string | null = null,
  ) {
    const reference = await this.referenciasRepository.findReferenceById(
      id,
      tenantId,
    );
    if (!reference) {
      throw new Error('Referência não encontrada!');
    }

    const update: Record<string, unknown> = {};
    let renamedTo: string | null = null;

    if (payload.name !== undefined) {
      const normalizedName = String(payload.name).trim().toUpperCase();
      if (!normalizedName) {
        throw new Error('Nome da referência é obrigatório!');
      }
      if (normalizedName !== reference.name) {
        const duplicate = await this.referenciasRepository.findReferenceByName(
          normalizedName,
          tenantId,
        );
        if (duplicate && String(duplicate._id) !== String(id)) {
          throw new Error('Já existe uma referência com este nome!');
        }
        update.name = normalizedName;
        renamedTo = normalizedName;
      }
    }

    if (payload.cargo !== undefined) {
      update.cargo = payload.cargo?.trim().toUpperCase() || undefined;
    }
    if (payload.telefone !== undefined) {
      update.telefone = payload.telefone?.trim() || undefined;
    }

    if (payload.parentId !== undefined) {
      if (payload.parentId === null || payload.parentId === '') {
        update.parentId = null;
      } else {
        await this.resolveParent(payload.parentId, tenantId);
        await this.assertNoCycle(id, payload.parentId, tenantId);
        update.parentId = toObjectId(payload.parentId);
      }
    }

    if (!Object.keys(update).length) {
      return reference;
    }

    update.updatedBy = toObjectId(userId);

    const updated = await this.referenciasRepository.updateReferenceById(
      id,
      { $set: update },
      tenantId,
    );

    if (renamedTo) {
      await this.referenciasRepository.renameFuncionariosReferencia(
        id,
        renamedTo,
        tenantId,
      );
    }

    await this.cacheService.bumpVersion(tenantId);
    return updated;
  }

  /**
   * Exclui a referência realocando seus filhos diretos para o parent dela.
   * Quando a referência é raiz, os filhos passam a ser raízes — nenhum nó
   * artificial é criado para ocupar o lugar.
   */
  async deleteReference(id: string, tenantId: string | null = null) {
    const reference = await this.referenciasRepository.findReferenceById(
      id,
      tenantId,
    );
    if (!reference) {
      throw new Error('Referência não encontrada!');
    }

    const parent = reference.parentId
      ? await this.referenciasRepository.findReferenceById(
          String(reference.parentId),
          tenantId,
        )
      : null;
    const newParentId: Types.ObjectId | null = parent
      ? (parent._id as Types.ObjectId)
      : null;

    const result = await this.runAtomically(async (session) => {
      // Ordem importa: os filhos são realocados antes da exclusão, de modo que
      // uma falha no meio do caminho nunca deixe nós órfãos apontando para um
      // documento inexistente.
      await this.referenciasRepository.reparentChildren(
        id,
        newParentId,
        tenantId,
        session,
      );
      await this.referenciasRepository.reassignFuncionarios(
        id,
        parent ? { _id: newParentId as Types.ObjectId, name: parent.name } : null,
        tenantId,
        session,
      );
      return this.referenciasRepository.deleteReferenceById(
        id,
        tenantId,
        session,
      );
    });

    await this.cacheService.bumpVersion(tenantId);
    return result;
  }

  private async runAtomically<T>(
    work: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    let session: ClientSession | null = null;
    try {
      session = await this.referenciasRepository.startSession();
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session as ClientSession);
      });
      return result;
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      return work();
    } finally {
      await session?.endSession().catch(() => undefined);
    }
  }
}
