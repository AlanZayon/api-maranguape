import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';
import { User } from '../auth/schemas/user.schema';
import { tenantFilter, toObjectId } from '../../common/utils/tenant.helpers';

export type LogActionInput = {
  tenantId?: unknown;
  userId?: unknown;
  action: string;
  entity: string;
  entityId?: unknown;
  meta?: Record<string, unknown>;
};

export type ListAuditOptions = {
  tenantId?: unknown;
  limit?: number;
  skip?: number;
  isSuperadmin?: boolean;
};

/** Ports legacy/services/auditService.js. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLog>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /** Best-effort audit write — never throws to callers that `.catch()`. */
  async logAction({
    tenantId = null,
    userId = null,
    action,
    entity,
    entityId = null,
    meta = {},
  }: LogActionInput): Promise<void> {
    try {
      await this.auditLogModel.create({
        tenantId: toObjectId(tenantId),
        userId: toObjectId(userId),
        action,
        entity,
        entityId: entityId != null ? String(entityId) : null,
        meta,
      });
    } catch (err) {
      this.logger.error(
        `Falha ao gravar audit log: ${(err as Error).message} action=${action} entity=${entity}`,
      );
    }
  }

  async list({
    tenantId = null,
    limit = 50,
    skip = 0,
    isSuperadmin = false,
  }: ListAuditOptions = {}) {
    const filter: Record<string, unknown> =
      !isSuperadmin && tenantId ? tenantFilter(String(tenantId)) : {};

    const safeLimit = Math.min(limit, 200);

    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.auditLogModel.countDocuments(filter),
    ]);

    const userIds = [
      ...new Set(
        items
          .map((item) => item.userId)
          .filter(Boolean)
          .map((id) => String(id)),
      ),
    ];

    let userMap: Record<string, string> = {};
    if (userIds.length) {
      try {
        const users = await this.userModel
          .find({ _id: { $in: userIds } })
          .select('username id')
          .lean();
        userMap = Object.fromEntries(
          users.map((u) => [String(u._id), u.username || u.id || 'usuário']),
        );
      } catch (err) {
        this.logger.error(
          `Falha ao enriquecer audit com usuários: ${(err as Error).message}`,
        );
      }
    }

    const enriched = items.map((item) => ({
      ...item,
      username: item.userId ? userMap[String(item.userId)] || null : null,
    }));

    return { items: enriched, total, limit: safeLimit, skip };
  }
}
