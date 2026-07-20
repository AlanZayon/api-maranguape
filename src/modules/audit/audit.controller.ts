import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { TENANT_ELEVATED, AuthUser } from '../../common/constants/roles';
import { AuditService } from './audit.service';

@Controller('api/audit')
@UseGuards(AuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(...TENANT_ELEVATED)
  async list(
    @Query('limit') limitRaw: string | undefined,
    @Query('skip') skipRaw: string | undefined,
    @CurrentUser() user: AuthUser | undefined,
    @TenantId() tenantId: string | null,
  ) {
    const limit = parseInt(limitRaw ?? '', 10) || 50;
    const skip = parseInt(skipRaw ?? '', 10) || 0;
    const isSuperadmin = user?.role === 'superadmin';

    return this.auditService.list({
      tenantId,
      limit,
      skip,
      isSuperadmin,
    });
  }
}
