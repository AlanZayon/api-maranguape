import { Injectable } from '@nestjs/common';
import { SetoresRepository } from './setores.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../../common/errors/app-error';
import { normalizarTexto } from '../../common/utils/normalizar-texto';
import { organizarSetores, SetorLike } from '../../common/utils/organizar-setores.util';
import { toObjectId } from '../../common/utils/tenant.helpers';
import { CreateSetorDto } from './dto/create-setor.dto';

export type MoveAuditContext = {
  tenantId?: string | null;
  userId?: string | null;
};

@Injectable()
export class SetoresService {
  constructor(
    private readonly setoresRepository: SetoresRepository,
    private readonly cacheService: CacheService,
    private readonly auditService: AuditService,
  ) {}

  async createSetor(
    data: CreateSetorDto,
    tenantId: string | null = null,
    userId: string | null = null,
  ) {
    const { nome, tipo, parent } = data;

    if (tipo === 'Subsetor') {
      if (!parent) {
        throw new AppError('Subsetor requer um nó pai', 400, 'VALIDATION_ERROR');
      }
      const parentNode = await this.setoresRepository.findById(
        parent,
        tenantId,
      );
      if (!parentNode) {
        throw new AppError('Nó pai não encontrado', 404, 'NOT_FOUND');
      }
    }

    const payload: Record<string, unknown> = {
      nome: normalizarTexto(nome),
      tipo,
      parent: parent ? toObjectId(parent) : null,
    };
    if (tenantId) payload.tenantId = toObjectId(tenantId);
    if (userId) payload.createdBy = toObjectId(userId);

    const setor = await this.setoresRepository.create(payload);

    if (parent) {
      await this.cacheService.clearCacheForSetor(parent, tenantId);
    }
    await this.cacheService.clearCacheForSetor(String(setor._id), tenantId);

    return setor.toObject ? setor.toObject() : setor;
  }

  async getSetoresOrganizados(tenantId: string | null = null) {
    const cacheKey = tenantId
      ? `tenant:${tenantId}:setoresOrganizados`
      : 'setoresOrganizados';

    return this.cacheService.getOrSetCache(cacheKey, async () => {
      const [setores, funcionariosPorSetor] = await Promise.all([
        this.setoresRepository.getAllSetores(tenantId),
        this.setoresRepository.countFuncionariosPorSetor(tenantId),
      ]);

      return organizarSetores(setores as SetorLike[], funcionariosPorSetor);
    });
  }

  async getMainSetores(tenantId: string | null = null) {
    const cacheKey = tenantId
      ? `tenant:${tenantId}:setores:null`
      : 'setores:null';
    return this.cacheService.getOrSetCache(cacheKey, async () => {
      return this.setoresRepository.findMainSetores(tenantId);
    });
  }

  async getSetorData(setorId: string, tenantId: string | null = null) {
    const cacheKey = tenantId
      ? `tenant:${tenantId}:setor:${setorId}:dados`
      : `setor:${setorId}:dados`;

    return this.cacheService.getOrSetCache(cacheKey, async () => {
      const subsetores = await this.setoresRepository.findSetorData(
        setorId,
        tenantId,
      );
      return { subsetores };
    });
  }

  /**
   * Direct children of a parent (or roots if parentId is null/undefined),
   * with direct + subtree employee counts.
   */
  async getChildren(
    parentId: string | null = null,
    tenantId: string | null = null,
  ) {
    const children = await this.setoresRepository.findChildren(
      parentId,
      tenantId,
    );
    if (!children.length) return [];

    const [funcionariosPorSetor, ...descendantIdLists] = await Promise.all([
      this.setoresRepository.countFuncionariosPorSetor(tenantId),
      ...children.map((c) =>
        this.setoresRepository.getDescendantIds(String(c._id), tenantId),
      ),
    ]);

    return children.map((child, i) => {
      const obj = child.toObject ? child.toObject() : { ...child };
      const ids = descendantIdLists[i] || [child._id];
      const subtree = ids.reduce(
        (sum: number, id: unknown) =>
          sum + (funcionariosPorSetor[String(id)] || 0),
        0,
      );
      const direct = funcionariosPorSetor[String(child._id)] || 0;
      return {
        ...obj,
        quantidadeFuncionarios: direct,
        quantidadeFuncionariosSubtree: subtree,
        temFilhos: ids.length > 1,
      };
    });
  }

  async renameSetor(
    id: string,
    nome: string,
    userId: string | null = null,
    tenantId: string | null = null,
  ) {
    const normalizedName = normalizarTexto(nome);
    const extra = userId ? { updatedBy: userId } : {};
    const setor = await this.setoresRepository.updateNome(
      id,
      normalizedName,
      extra,
      tenantId,
    );
    if (!setor) {
      throw new AppError('Setor não encontrado', 404, 'NOT_FOUND');
    }

    if (setor?.parent) {
      await this.cacheService.clearCacheForSetor(
        String(setor.parent),
        tenantId,
      );
    }
    await this.cacheService.clearCacheForSetor(id, tenantId);
    return setor;
  }

  /**
   * Move / reparent a node. parent = null promotes to root (Setor only).
   */
  async moveSetor(
    id: string,
    parent: string | null | undefined,
    auditContext: MoveAuditContext = {},
  ) {
    const tenantId = auditContext.tenantId || null;
    const setor = await this.setoresRepository.findById(id, tenantId);
    if (!setor) {
      throw new AppError('Setor não encontrado', 404, 'NOT_FOUND');
    }

    const previousParent = setor.parent ? String(setor.parent) : null;
    const nextParent =
      parent === undefined || parent === null || parent === ''
        ? null
        : String(parent);

    if (previousParent === nextParent) {
      return setor;
    }

    if (nextParent === String(id)) {
      throw new AppError(
        'Um nó não pode ser pai de si mesmo',
        400,
        'VALIDATION_ERROR',
      );
    }

    if (nextParent === null) {
      if (setor.tipo !== 'Setor') {
        throw new AppError(
          'Apenas Setor pode ser raiz (sem pai)',
          400,
          'VALIDATION_ERROR',
        );
      }
    } else {
      const parentNode = await this.setoresRepository.findById(
        nextParent,
        tenantId,
      );
      if (!parentNode) {
        throw new AppError('Nó pai não encontrado', 404, 'NOT_FOUND');
      }

      const descendantIds = await this.setoresRepository.getDescendantIds(
        id,
        tenantId,
      );
      const descendantSet = new Set(descendantIds.map((d) => String(d)));
      if (descendantSet.has(nextParent)) {
        throw new AppError(
          'Não é possível mover um nó para dentro da própria subárvore',
          400,
          'VALIDATION_ERROR',
        );
      }
    }

    const extra = auditContext.userId
      ? { updatedBy: auditContext.userId }
      : {};
    const updated = await this.setoresRepository.updateParent(
      id,
      nextParent,
      extra,
      tenantId,
    );

    if (previousParent) {
      await this.cacheService.clearCacheForSetor(previousParent, tenantId);
    }
    if (nextParent) {
      await this.cacheService.clearCacheForSetor(nextParent, tenantId);
    }
    await this.cacheService.clearCacheForSetor(id, tenantId);

    this.auditService
      .logAction({
        tenantId: auditContext.tenantId,
        userId: auditContext.userId,
        action: 'UPDATE',
        entity: 'setor',
        entityId: id,
        meta: {
          nome: updated?.nome || setor?.nome,
          previousParent,
          nextParent,
        },
      })
      .catch(() => {});

    return updated;
  }

  async deleteSetor(id: string, auditContext: MoveAuditContext = {}) {
    const tenantId = auditContext.tenantId || null;
    const setor = await this.setoresRepository.findById(id, tenantId);
    if (!setor) {
      throw new AppError('Setor não encontrado', 404, 'NOT_FOUND');
    }

    const descendantIds = await this.setoresRepository.getDescendantIds(
      id,
      tenantId,
    );
    if (!descendantIds.length) {
      throw new AppError('Setor não encontrado', 404, 'NOT_FOUND');
    }

    const count = await this.setoresRepository.countFuncionariosInSetores(
      descendantIds,
    );

    if (count > 0) {
      throw new AppError(
        'Não é possível excluir: existem funcionários vinculados',
        409,
        'CONFLICT',
      );
    }

    await this.setoresRepository.deleteWithChildren(id, tenantId);
    await this.cacheService.clearCacheForSetor(id, tenantId);

    this.auditService
      .logAction({
        tenantId: auditContext.tenantId,
        userId: auditContext.userId,
        action: 'DELETE',
        entity: 'setor',
        entityId: id,
        meta: {
          nome: setor.nome,
          descendantCount: descendantIds.length,
        },
      })
      .catch(() => {});
  }
}
