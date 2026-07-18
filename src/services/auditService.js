const AuditLog = require('../models/auditLogSchema');
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

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(limit, 200))
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return { items, total, limit, skip };
  }
}

module.exports = AuditService;
