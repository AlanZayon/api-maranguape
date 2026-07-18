const User = require('../models/usuariosSchema');

class AuthRepository {
  static async findUserById(id) {
    return await User.findOne({ id });
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
