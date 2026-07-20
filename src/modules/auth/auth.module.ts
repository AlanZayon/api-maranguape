import { Module } from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditModule } from '../audit/audit.module';

/**
 * `User` and `Tenant` mongoose models are registered globally by
 * `DatabaseModule` (see src/database/database.module.ts) — no local
 * `MongooseModule.forFeature` needed here.
 */
@Module({
  imports: [AuditModule],
  controllers: [AuthController, UserController],
  providers: [AuthRepository, AuthService, UserService, AuthGuard, RolesGuard],
  exports: [AuthRepository, AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
