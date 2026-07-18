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
      const parentNode = await SetorRepository.findById(parent);
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
      await CacheService.clearCacheForSetor(parent);
    }
    await CacheService.clearCacheForSetor(setor._id);

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
    return await CacheService.getOrSetCache(
      `setor:${setorId}:dados`,
      async () => {
        const subsetores = await SetorRepository.findSetorData(setorId, tenantId);
        return { subsetores };
      }
    );
  }

  static async renameSetor(id, nome, userId = null) {
    const normalizedName = normalizarTexto(nome);
    const extra = userId ? { updatedBy: userId } : {};
    const setor = await SetorRepository.updateNome(id, normalizedName, extra);

    if (setor?.parent) {
      await CacheService.clearCacheForSetor(setor.parent);
    }
    await CacheService.clearCacheForSetor(id);
    return setor;
  }

  /**
   * Move / reparent a node. parent = null promotes to root (Setor only).
   */
  static async moveSetor(id, parent, auditContext = {}) {
    const setor = await SetorRepository.findById(id);
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
      const parentNode = await SetorRepository.findById(nextParent);
      if (!parentNode) {
        throw new AppError('Nó pai não encontrado', 404, 'NOT_FOUND');
      }

      const descendantIds = await SetorRepository.getDescendantIds(id);
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
      extra
    );

    if (previousParent) {
      await CacheService.clearCacheForSetor(previousParent);
    }
    if (nextParent) {
      await CacheService.clearCacheForSetor(nextParent);
    }
    await CacheService.clearCacheForSetor(id);

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
    const setor = await SetorRepository.findById(id);
    if (!setor) {
      throw new AppError('Setor não encontrado', 404, 'NOT_FOUND');
    }

    const descendantIds = await SetorRepository.getDescendantIds(id);
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

    await SetorRepository.deleteWithChildren(id);
    await CacheService.clearCacheForSetor(id);

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
