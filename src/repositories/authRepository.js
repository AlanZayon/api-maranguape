const User = require('../models/usuariosSchema');

class AuthRepository {
  static async findUserById(id) {
    return await User.findOne({ id });
  }

  /**
   * Login lookup: prefer exact `id` field, then username scoped to tenant.
   * Superadmins (tenantId null) match by id or username without tenant.
   */
  static async findUserForLogin(loginId, tenantId = null) {
    if (!loginId) return null;

    const byId = await User.findOne({ id: loginId });
    if (byId) return byId;

    if (tenantId) {
      const scoped = await User.findOne({
        username: loginId,
        tenantId,
      });
      if (scoped) return scoped;
    }

    // Platform / legacy: username with null tenant (superadmin) or single match
    const byUsername = await User.find({ username: loginId }).limit(2);
    if (byUsername.length === 1) return byUsername[0];
    if (tenantId) {
      return (
        byUsername.find((u) => String(u.tenantId) === String(tenantId)) || null
      );
    }
    return byUsername.find((u) => u.role === 'superadmin') || null;
  }

  static async findUserByMongoId(_id) {
    return await User.findById(_id);
  }

  static async findUsers(filter = {}) {
    return User.find(filter)
      .select('-passwordHash -lastValidToken')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async createUser(data) {
    return User.create(data);
  }

  static async updateUser(_id, data) {
    return User.findByIdAndUpdate(_id, data, { new: true });
  }

  static async deleteUser(_id) {
    return User.findByIdAndDelete(_id);
  }

  static async updateUserToken(userId, token) {
    return await User.findByIdAndUpdate(
      userId,
      {
        lastValidToken: token,
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { new: true }
    );
  }

  static async invalidateUserToken(userId) {
    return await User.findByIdAndUpdate(
      userId,
      { lastValidToken: null },
      { new: true }
    );
  }
}

module.exports = AuthRepository;
