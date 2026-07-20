import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { tenantFilter } from '../../common/utils/tenant.helpers';

@Injectable()
export class AuthRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  findUserById(id: string) {
    return this.userModel.findOne({ id });
  }

  async findUserForLogin(loginId: string, tenantId: string | null = null) {
    if (!loginId) return null;

    const byId = await this.userModel.findOne({ id: loginId });
    if (byId) return byId;

    if (tenantId) {
      const scoped = await this.userModel.findOne({
        username: loginId,
        ...tenantFilter(tenantId),
      });
      if (scoped) return scoped;
    }

    const byUsername = await this.userModel.find({ username: loginId }).limit(2);
    if (byUsername.length === 1) return byUsername[0];
    if (tenantId) {
      return (
        byUsername.find((u) => String(u.tenantId) === String(tenantId)) || null
      );
    }
    return byUsername.find((u) => u.role === 'superadmin') || null;
  }

  findUserByMongoId(_id: string) {
    return this.userModel.findById(_id);
  }

  findUsers(filter: Record<string, unknown> = {}) {
    return this.userModel
      .find(filter)
      .select('-passwordHash -lastValidToken')
      .sort({ createdAt: -1 })
      .lean();
  }

  createUser(data: Record<string, unknown>) {
    return this.userModel.create(data);
  }

  updateUser(_id: string, data: Record<string, unknown>) {
    return this.userModel.findByIdAndUpdate(_id, data, { new: true });
  }

  deleteUser(_id: string) {
    return this.userModel.findByIdAndDelete(_id);
  }

  updateUserToken(userId: string, token: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        lastValidToken: token,
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { new: true },
    );
  }

  invalidateUserToken(userId: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { lastValidToken: null },
      { new: true },
    );
  }
}
