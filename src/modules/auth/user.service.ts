import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AppError } from '../../common/errors/app-error';
import { AuthUser } from '../../common/constants/roles';
import { tenantFilter, toObjectId } from '../../common/utils/tenant.helpers';
import { AuditService } from '../audit/audit.service';
import { User } from './schemas/user.schema';

const TENANT_ASSIGNABLE_ROLES = ['admin', 'user'];

export type CreateUserInput = {
  id?: string;
  username?: string;
  password: string;
  role?: string;
  tenantId?: string | null;
};

export type UpdateUserInput = {
  username?: string;
  role?: string;
  password?: string;
  tenantId?: string | null;
};

/** Ports legacy/services/userService.js. */
@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly auditService: AuditService,
  ) {}

  buildScopeFilter(requester: AuthUser): Record<string, unknown> {
    if (requester.role === 'superadmin') {
      return {};
    }
    if (!requester.tenantId) {
      throw new AppError(
        'Usuário sem tenant associado',
        403,
        'TENANT_REQUIRED',
      );
    }
    // Must cast to ObjectId — string queries do not match BSON ObjectId fields
    return tenantFilter(requester.tenantId);
  }

  assertAssignableRole(requester: AuthUser, role: string): void {
    if (requester.role === 'superadmin') {
      return;
    }
    if (!TENANT_ASSIGNABLE_ROLES.includes(role)) {
      throw new AppError(
        'Papel inválido. Use admin ou user',
        400,
        'VALIDATION_ERROR',
      );
    }
  }

  async list(requester: AuthUser) {
    const filter = this.buildScopeFilter(requester);
    return this.userModel
      .find(filter)
      .select('-passwordHash -lastValidToken')
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(requester: AuthUser, data: CreateUserInput) {
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
        'VALIDATION_ERROR',
      );
    }

    this.assertAssignableRole(requester, role);

    let resolvedTenantId: string | null = tenantId || requester.tenantId || null;

    if (requester.role !== 'superadmin') {
      resolvedTenantId = requester.tenantId;
      if (role === 'superadmin' || role === 'owner') {
        throw new AppError(
          'Não é permitido atribuir este papel',
          403,
          'FORBIDDEN',
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = id || randomUUID();

    try {
      const user = await this.userModel.create({
        id: userId,
        username,
        passwordHash,
        role,
        tenantId: toObjectId(resolvedTenantId),
        createdBy: toObjectId(requester.id),
      });

      this.auditService
        .logAction({
          tenantId: resolvedTenantId,
          userId: requester.id,
          action: 'CREATE',
          entity: 'user',
          entityId: user._id,
          meta: { username, role },
        })
        .catch(() => undefined);

      const obj = user.toObject() as unknown as Record<string, unknown>;
      delete obj.passwordHash;
      delete obj.lastValidToken;
      return obj;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new AppError('Usuário ou id já existente', 409, 'CONFLICT');
      }
      throw err;
    }
  }

  async update(
    requester: AuthUser,
    userMongoId: string,
    data: UpdateUserInput,
  ) {
    const filter = {
      _id: userMongoId,
      ...this.buildScopeFilter(requester),
    };

    const user = await this.userModel.findOne(filter);
    if (!user) {
      throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');
    }

    if (data.role !== undefined) {
      this.assertAssignableRole(requester, data.role);

      if (requester.role !== 'superadmin' && data.role === 'superadmin') {
        throw new AppError(
          'Apenas superadmin pode promover a superadmin',
          403,
          'FORBIDDEN',
        );
      }

      if (user.role === 'owner' && data.role !== 'owner') {
        const ownersLeft = await this.userModel.countDocuments({
          tenantId: user.tenantId,
          role: 'owner',
          _id: { $ne: user._id },
        });
        if (ownersLeft === 0) {
          throw new AppError(
            'Não é possível remover o único dono do tenant',
            400,
            'VALIDATION_ERROR',
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
      user.tenantId = data.tenantId ? new Types.ObjectId(data.tenantId) : null;
    }
    user.updatedBy = requester.id ? new Types.ObjectId(requester.id) : null;

    await user.save();

    const obj = user.toObject() as unknown as Record<string, unknown>;
    delete obj.passwordHash;
    delete obj.lastValidToken;
    return obj;
  }

  async remove(requester: AuthUser, userMongoId: string) {
    const filter = {
      _id: userMongoId,
      ...this.buildScopeFilter(requester),
    };

    const user = await this.userModel.findOne(filter);
    if (!user) {
      throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');
    }

    if (String(user._id) === String(requester.id)) {
      throw new AppError(
        'Não é possível excluir o próprio usuário',
        400,
        'VALIDATION_ERROR',
      );
    }

    if (user.role === 'owner') {
      throw new AppError(
        'Não é possível excluir o dono do tenant',
        400,
        'VALIDATION_ERROR',
      );
    }

    await this.userModel.deleteOne({ _id: user._id });

    this.auditService
      .logAction({
        tenantId: user.tenantId,
        userId: requester.id,
        action: 'DELETE',
        entity: 'user',
        entityId: user._id,
        meta: { username: user.username },
      })
      .catch(() => undefined);

    return { message: 'Usuário removido com sucesso' };
  }
}
