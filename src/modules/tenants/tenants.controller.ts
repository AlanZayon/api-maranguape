import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { TENANT_ELEVATED, AuthUser } from '../../common/constants/roles';
import { AppError } from '../../common/errors/app-error';
import { BrandingPolicyService } from '../../config/branding-policy.service';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { COLOR_FIELDS } from './branding.utils';

@Controller('api/tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly brandingPolicyService: BrandingPolicyService,
  ) {}

  @Get('branding-policy')
  brandingPolicy() {
    const policy = this.brandingPolicyService.getPolicy();
    return {
      customCssEnabled: policy.customCssEnabled,
      customCssMaxLength: policy.customCssMaxLength,
      allowedSelectors: policy.allowedSelectors,
      editableFields: policy.editableFields,
      fontUrlHosts: policy.fontUrlHosts,
      assetMaxBytes: policy.brandingAssetMaxBytes,
      colorFields: [...COLOR_FIELDS],
    };
  }

  @Get('by-slug/:slug')
  async bySlug(@Param('slug') slug: string) {
    return this.tenantsService.getBySlug(slug);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(
    @CurrentUser() user: AuthUser | undefined,
    @TenantId() tenantId: string | null,
  ) {
    if (!tenantId) {
      throw new AppError(
        'Nenhum tenant associado ao usuário',
        400,
        'NO_TENANT',
      );
    }
    return this.tenantsService.getById(tenantId);
  }

  @Patch('me')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...TENANT_ELEVATED)
  async updateMe(
    @Body() body: UpdateTenantDto,
    @CurrentUser() user: AuthUser | undefined,
    @TenantId() tenantId: string | null,
  ) {
    if (!tenantId) {
      throw new AppError(
        'Nenhum tenant associado ao usuário',
        400,
        'NO_TENANT',
      );
    }
    if (user?.role === 'superadmin' && !user?.tenantId) {
      throw new AppError(
        'Use PATCH /api/tenants/:id como superadmin',
        400,
        'USE_TENANT_ID',
      );
    }
    return this.tenantsService.updateMe(tenantId, body);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('superadmin')
  async list() {
    const tenants = await this.tenantsService.list();
    return { tenants };
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('superadmin')
  async create(@Body() body: CreateTenantDto) {
    return this.tenantsService.create(body);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('superadmin')
  async getById(@Param('id') id: string) {
    return this.tenantsService.getById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('superadmin')
  async update(@Param('id') id: string, @Body() body: UpdateTenantDto) {
    return this.tenantsService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('superadmin')
  async deactivate(@Param('id') id: string) {
    return this.tenantsService.deactivate(id);
  }

  @Post(':id/assets')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...TENANT_ELEVATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAsset(
    @Param('id') tenantId: string,
    @Body('kind') bodyKind: string | undefined,
    @Query('kind') queryKind: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    const kind = bodyKind || queryKind || 'logo';
    const requesterTenant = user?.tenantId ? String(user.tenantId) : null;

    if (user?.role !== 'superadmin' && requesterTenant !== String(tenantId)) {
      throw new AppError('Acesso negado', 403, 'FORBIDDEN');
    }

    return this.tenantsService.uploadAsset(tenantId, file, kind);
  }
}
