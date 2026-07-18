const AuditLog = require('../models/auditLogSchema');
const User = require('../models/usuariosSchema');
const logger = require('../utils/Logger');

class AuditService {
  /**
   * Best-effort audit write — never throws to callers that .catch().
   */
  static async logAction({
    tenantId = null,
    userId = null,
    action,
    entity,
    entityId = null,
    meta = {},
  }) {
    try {
      await AuditLog.create({
        tenantId: tenantId || null,
        userId: userId || null,
        action,
        entity,
        entityId: entityId != null ? String(entityId) : null,
        meta,
      });
    } catch (err) {
      logger.error('Falha ao gravar audit log', {
        message: err.message,
        action,
        entity,
      });
    }
  }

  static async list({ tenantId = null, limit = 50, skip = 0, isSuperadmin = false } = {}) {
    const filter = {};
    if (!isSuperadmin && tenantId) {
      filter.tenantId = tenantId;
    }

    const safeLimit = Math.min(limit, 200);

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    const userIds = [
      ...new Set(
        items
          .map((item) => item.userId)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];

    let userMap = {};
    if (userIds.length) {
      try {
        const users = await User.find({ _id: { $in: userIds } })
          .select('username id')
          .lean();
        userMap = Object.fromEntries(
          users.map((u) => [
            String(u._id),
            u.username || u.id || 'usuário',
          ])
        );
      } catch (err) {
        logger.error('Falha ao enriquecer audit com usuários', {
          message: err.message,
        });
      }
    }

    const enriched = items.map((item) => ({
      ...item,
      username: item.userId ? userMap[String(item.userId)] || null : null,
    }));

    return { items: enriched, total, limit: safeLimit, skip };
  }
}

module.exports = AuditService;
