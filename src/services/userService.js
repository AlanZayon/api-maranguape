const User = require('../models/usuariosSchema');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const AppError = require('../utils/AppError');
const AuditService = require('./auditService');

const TENANT_ASSIGNABLE_ROLES = ['admin', 'user'];

class UserService {
  static buildScopeFilter(requester) {
    if (requester.role === 'superadmin') {
      return {};
    }
    if (!requester.tenantId) {
      throw new AppError(
        'Usuário sem tenant associado',
        403,
        'TENANT_REQUIRED'
      );
    }
    return { tenantId: requester.tenantId };
  }

  static assertAssignableRole(requester, role) {
    if (requester.role === 'superadmin') {
      return;
    }
    if (!TENANT_ASSIGNABLE_ROLES.includes(role)) {
      throw new AppError(
        'Papel inválido. Use admin ou user',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  static async list(requester) {
    const filter = this.buildScopeFilter(requester);
    return User.find(filter)
      .select('-passwordHash -lastValidToken')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async create(requester, data) {
    const {
      id,
      username: rawUsername,
      password,
      role = 'user',
      tenantId,
    } = data;

    const username = rawUsername || id;
    if (!username || !password) {
      throw new AppError(
        'username (ou id) e password são obrigatórios',
        400,
        'VALIDATION_ERROR'
      );
    }

    this.assertAssignableRole(requester, role);

    let resolvedTenantId = tenantId || requester.tenantId || null;

    if (requester.role !== 'superadmin') {
      resolvedTenantId = requester.tenantId;
      if (role === 'superadmin' || role === 'owner') {
        throw new AppError(
          'Não é permitido atribuir este papel',
          403,
          'FORBIDDEN'
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = id || randomUUID();

    try {
      const user = await User.create({
        id: userId,
        username,
        passwordHash,
        role,
        tenantId: resolvedTenantId,
        createdBy: requester.id || null,
      });

      AuditService.logAction({
        tenantId: resolvedTenantId,
        userId: requester.id,
        action: 'CREATE',
        entity: 'user',
        entityId: user._id,
        meta: { username, role },
      }).catch(() => {});

      const obj = user.toObject();
      delete obj.passwordHash;
      delete obj.lastValidToken;
      return obj;
    } catch (err) {
      if (err.code === 11000) {
        throw new AppError('Usuário ou id já existente', 409, 'CONFLICT');
      }
      throw err;
    }
  }

  static async update(requester, userMongoId, data) {
    const filter = {
      _id: userMongoId,
      ...this.buildScopeFilter(requester),
    };

    const user = await User.findOne(filter);
    if (!user) {
      throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');
    }

    if (data.role !== undefined) {
      this.assertAssignableRole(requester, data.role);

      if (requester.role !== 'superadmin' && data.role === 'superadmin') {
        throw new AppError(
          'Apenas superadmin pode promover a superadmin',
          403,
          'FORBIDDEN'
        );
      }

      if (user.role === 'owner' && data.role !== 'owner') {
        const ownersLeft = await User.countDocuments({
          tenantId: user.tenantId,
          role: 'owner',
          _id: { $ne: user._id },
        });
        if (ownersLeft === 0) {
          throw new AppError(
            'Não é possível remover o único dono do tenant',
            400,
            'VALIDATION_ERROR'
          );
        }
      }
    }

    if (data.username) user.username = data.username;
    if (data.role) user.role = data.role;
    if (data.password) {
      user.passwordHash = await bcrypt.hash(data.password, 10);
    }
    if (requester.role === 'superadmin' && data.tenantId !== undefined) {
      user.tenantId = data.tenantId;
    }
    user.updatedBy = requester.id || null;

    await user.save();

    const obj = user.toObject();
    delete obj.passwordHash;
    delete obj.lastValidToken;
    return obj;
  }

  static async remove(requester, userMongoId) {
    const filter = {
      _id: userMongoId,
      ...this.buildScopeFilter(requester),
    };

    const user = await User.findOne(filter);
    if (!user) {
      throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');
    }

    if (String(user._id) === String(requester.id)) {
      throw new AppError(
        'Não é possível excluir o próprio usuário',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (user.role === 'owner') {
      throw new AppError(
        'Não é possível excluir o dono do tenant',
        400,
        'VALIDATION_ERROR'
      );
    }

    await User.deleteOne({ _id: user._id });

    AuditService.logAction({
      tenantId: user.tenantId,
      userId: requester.id,
      action: 'DELETE',
      entity: 'user',
      entityId: user._id,
      meta: { username: user.username },
    }).catch(() => {});

    return { message: 'Usuário removido com sucesso' };
  }
}

module.exports = UserService;
