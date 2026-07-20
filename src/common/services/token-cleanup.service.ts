import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../modules/auth/schemas/user.schema';

/**
 * Ports legacy/scripts/validationToken.js: clears stale `lastValidToken` /
 * `tokenExpiresAt` once a session's token has expired. Runs once on boot
 * (mirrors the legacy immediate `checkExpiredTokens()` call) and then hourly.
 */
@Injectable()
export class TokenCleanupService implements OnModuleInit {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  onModuleInit() {
    void this.checkExpiredTokens();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredTokens(): Promise<void> {
    this.logger.log('Verificando tokens expirados...');
    const expirationDate = new Date();

    try {
      const result = await this.userModel.updateMany(
        {
          lastValidToken: { $ne: null },
          tokenExpiresAt: { $lte: expirationDate },
        },
        {
          $set: {
            lastValidToken: null,
            tokenExpiresAt: null,
          },
        },
      );

      this.logger.log(`Tokens expirados limpos: ${result.modifiedCount}`);
    } catch (err) {
      this.logger.error(
        `Erro ao verificar tokens expirados: ${(err as Error).message}`,
      );
    }
  }
}
