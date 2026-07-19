const SetorRepository = require('../repositories/SetorRepository');
const FuncionarioRepository = require('../repositories/FuncionariosRepository');
const CacheService = require('../services/CacheService');
const organizarSetores = require('../utils/organizarSetores');
const normalizarTexto = require('../utils/normalizarTexto');
const AppError = require('../utils/AppError');
const AuditService = require('./auditService');

class SetorService {
  static async createSetor(data, tenantId = null, userId = null) {
    const { nome, tipo, parent } = data;

    if (tipo === 'Subsetor') {
      if (!parent) {
        throw new AppError(
          'Subsetor requer um nó pai',
          400,
          'VALIDATION_ERROR'
        );
      }
      const parentNode = await SetorRepository.findById(parent, tenantId);
      if (!parentNode) {
        throw new AppError('Nó pai não encontrado', 404, 'NOT_FOUND');
      }
    }

    const payload = {
      nome: normalizarTexto(nome),
      tipo,
      parent: parent || null,
    };
    if (tenantId) payload.tenantId = tenantId;
    if (userId) payload.createdBy = userId;

    const setor = await SetorRepository.create(payload);

    if (parent) {
      await CacheService.clearCacheForSetor(parent, tenantId);
    }
    await CacheService.clearCacheForSetor(setor._id, tenantId);

    return setor;
  }

  static async getSetoresOrganizados(tenantId = null) {
    const cacheKey = tenantId
      ? `tenant:${tenantId}:setoresOrganizados`
      : 'setoresOrganizados';

    return await CacheService.getOrSetCache(cacheKey, async () => {
      const [setores, funcionariosPorSetor] = await Promise.all([
        SetorRepository.getAllSetores(tenantId),
        FuncionarioRepository.countFuncionariosPorSetor(tenantId),
      ]);

      return organizarSetores(setores, funcionariosPorSetor);
    });
  }

  static async getMainSetores(tenantId = null) {
    const cacheKey = tenantId ? `tenant:${tenantId}:setores:null` : 'setores:null';
    return await CacheService.getOrSetCache(cacheKey, async () => {
      return await SetorRepository.findMainSetores(tenantId);
    });
  }

  static async getSetorData(setorId, tenantId = null) {
    const cacheKey = tenantId
      ? `tenant:${tenantId}:setor:${setorId}:dados`
      : `setor:${setorId}:dados`;

    return await CacheService.getOrSetCache(cacheKey, async () => {
      const subsetores = await SetorRepository.findSetorData(setorId, tenantId);
      return { subsetores };
    });
  }

  /**
   * Direct children of a parent (or roots if parentId is null/undefined),
   * with direct + subtree employee counts.
   */
  static async getChildren(parentId = null, tenantId = null) {
    const children = await SetorRepository.findChildren(parentId, tenantId);
    if (!children.length) return [];

    const [funcionariosPorSetor, ...descendantIdLists] = await Promise.all([
      FuncionarioRepository.countFuncionariosPorSetor(tenantId),
      ...children.map((c) =>
        SetorRepository.getDescendantIds(c._id, tenantId)
      ),
    ]);

    return children.map((child, i) => {
      const obj = child.toObject ? child.toObject() : { ...child };
      const ids = descendantIdLists[i] || [child._id];
      const subtree = ids.reduce(
        (sum, id) => sum + (funcionariosPorSetor[String(id)] || 0),
        0
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

  static async renameSetor(id, nome, userId = null, tenantId = null) {
    const normalizedName = normalizarTexto(nome);
    const extra = userId ? { updatedBy: userId } : {};
    const setor = await SetorRepository.updateNome(
      id,
      normalizedName,
      extra,
      tenantId
    );
    if (!setor) {
      throw new AppError('Setor não encontrado', 404, 'NOT_FOUND');
    }

    if (setor?.parent) {
      await CacheService.clearCacheForSetor(setor.parent, tenantId);
    }
    await CacheService.clearCacheForSetor(id, tenantId);
    return setor;
  }

  /**
   * Move / reparent a node. parent = null promotes to root (Setor only).
   */
  static async moveSetor(id, parent, auditContext = {}) {
    const tenantId = auditContext.tenantId || null;
    const setor = await SetorRepository.findById(id, tenantId);
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
        'VALIDATION_ERROR'
      );
    }

    if (nextParent === null) {
      if (setor.tipo !== 'Setor') {
        throw new AppError(
          'Apenas Setor pode ser raiz (sem pai)',
          400,
          'VALIDATION_ERROR'
        );
      }
    } else {
      const parentNode = await SetorRepository.findById(nextParent, tenantId);
      if (!parentNode) {
        throw new AppError('Nó pai não encontrado', 404, 'NOT_FOUND');
      }

      const descendantIds = await SetorRepository.getDescendantIds(id, tenantId);
      const descendantSet = new Set(descendantIds.map((d) => String(d)));
      if (descendantSet.has(nextParent)) {
        throw new AppError(
          'Não é possível mover um nó para dentro da própria subárvore',
          400,
          'VALIDATION_ERROR'
        );
      }
    }

    const extra = auditContext.userId
      ? { updatedBy: auditContext.userId }
      : {};
    const updated = await SetorRepository.updateParent(
      id,
      nextParent,
      extra,
      tenantId
    );

    if (previousParent) {
      await CacheService.clearCacheForSetor(previousParent, tenantId);
    }
    if (nextParent) {
      await CacheService.clearCacheForSetor(nextParent, tenantId);
    }
    await CacheService.clearCacheForSetor(id, tenantId);

    AuditService.logAction({
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
    }).catch(() => {});

    return updated;
  }

  static async deleteSetor(id, auditContext = {}) {
    const tenantId = auditContext.tenantId || null;
    const setor = await SetorRepository.findById(id, tenantId);
    if (!setor) {
      throw new AppError('Setor não encontrado', 404, 'NOT_FOUND');
    }

    const descendantIds = await SetorRepository.getDescendantIds(id, tenantId);
    if (!descendantIds.length) {
      throw new AppError('Setor não encontrado', 404, 'NOT_FOUND');
    }

    const count =
      await FuncionarioRepository.countFuncionariosInSetores(
        descendantIds
      );

    if (count > 0) {
      throw new AppError(
        'Não é possível excluir: existem funcionários vinculados',
        409,
        'CONFLICT'
      );
    }

    await SetorRepository.deleteWithChildren(id, tenantId);
    await CacheService.clearCacheForSetor(id, tenantId);

    AuditService.logAction({
      tenantId: auditContext.tenantId,
      userId: auditContext.userId,
      action: 'DELETE',
      entity: 'setor',
      entityId: id,
      meta: {
        nome: setor.nome,
        descendantCount: descendantIds.length,
      },
    }).catch(() => {});
  }
}

module.exports = SetorService;
