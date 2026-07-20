import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import {
  TENANT_STAFF,
  TENANT_ELEVATED,
  AuthUser,
} from '../../common/constants/roles';
import { SetoresService } from './setores.service';
import { CreateSetorDto } from './dto/create-setor.dto';
import { RenameSetorDto } from './dto/rename-setor.dto';
import { MoveSetorDto } from './dto/move-setor.dto';

@Controller('api/setores')
@UseGuards(AuthGuard, RolesGuard)
export class SetoresController {
  constructor(private readonly setoresService: SetoresService) {}

  @Post()
  @Roles(...TENANT_STAFF)
  async createSetor(
    @Body() body: CreateSetorDto,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    const result = await this.setoresService.createSetor(
      body,
      tenantId,
      user?.id,
    );
    return result;
  }

  @Get('setoresOrganizados')
  async getSetoresOrganizados(@TenantId() tenantId: string | null) {
    const setores = await this.setoresService.getSetoresOrganizados(
      tenantId,
    );
    return { setores };
  }

  @Get('setoresMain')
  async getMainSetores(@TenantId() tenantId: string | null) {
    const setores = await this.setoresService.getMainSetores(tenantId);
    return { setores };
  }

  @Get('roots')
  async getRoots(@TenantId() tenantId: string | null) {
    const children = await this.setoresService.getChildren(null, tenantId);
    return { children };
  }

  @Get('dados/:setorId')
  async getSetorData(
    @Param('setorId') setorId: string,
    @TenantId() tenantId: string | null,
  ) {
    return this.setoresService.getSetorData(setorId, tenantId);
  }

  @Get(':id/children')
  async getChildren(
    @Param('id') id: string,
    @TenantId() tenantId: string | null,
  ) {
    const children = await this.setoresService.getChildren(id, tenantId);
    return { children };
  }

  @Put('rename/:id')
  @Roles(...TENANT_STAFF)
  async renameSetor(
    @Param('id') id: string,
    @Body() body: RenameSetorDto,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.setoresService.renameSetor(
      id,
      body.nome,
      user?.id,
      tenantId,
    );
  }

  @Put(':id/parent')
  @Roles(...TENANT_STAFF)
  async moveSetor(
    @Param('id') id: string,
    @Body() body: MoveSetorDto,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.setoresService.moveSetor(id, body.parent, {
      tenantId,
      userId: user?.id,
    });
  }

  @Delete('del/:id')
  @Roles(...TENANT_ELEVATED)
  @HttpCode(HttpStatus.OK)
  async deleteSetor(
    @Param('id') id: string,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    await this.setoresService.deleteSetor(id, {
      tenantId,
      userId: user?.id,
    });
    return { message: 'Setor e seus filhos deletados com sucesso' };
  }
}
