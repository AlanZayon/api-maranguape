import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { TENANT_ELEVATED } from '../../common/constants/roles';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles(...TENANT_ELEVATED)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async summary(@TenantId() tenantId: string | null) {
    return this.dashboardService.getSummary(tenantId);
  }

  @Get('contratos')
  async contratos(
    @TenantId() tenantId: string | null,
    @Query('within') withinRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
  ) {
    const withinDays = parseInt(withinRaw ?? '', 10) || 90;
    const limit = parseInt(limitRaw ?? '', 10) || 20;
    const items = await this.dashboardService.getContratos(tenantId, {
      withinDays: Math.min(Math.max(withinDays, 1), 365),
      limit: Math.min(Math.max(limit, 1), 100),
    });
    return { items };
  }

  @Get('payroll')
  async payroll(@TenantId() tenantId: string | null) {
    return this.dashboardService.getPayroll(tenantId);
  }
}
