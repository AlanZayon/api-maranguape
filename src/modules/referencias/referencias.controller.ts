import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { TENANT_ELEVATED, AuthUser } from '../../common/constants/roles';
import { ReferenciasService } from './referencias.service';
import { RegisterReferenceDto } from './dto/register-reference.dto';

@Controller('api/referencias')
@UseGuards(AuthGuard, RolesGuard)
export class ReferenciasController {
  constructor(private readonly referenciasService: ReferenciasService) {}

  @Post('register-reference')
  @Roles(...TENANT_ELEVATED)
  async registerReference(
    @Body() body: RegisterReferenceDto,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
    @Res() res: Response,
  ) {
    try {
      await this.referenciasService.registerReference(
        body,
        tenantId,
        user?.id || null,
      );
      return res
        .status(HttpStatus.CREATED)
        .json({ message: 'Referência registrada com sucesso!' });
    } catch (error) {
      const message = (error as Error).message;
      console.error('Erro ao registrar referência:', message);
      const status =
        message.includes('obrigatór') ||
        message.includes('existe') ||
        message.includes('já está cadastrado') ||
        message.includes('não encontrado') ||
        message.includes('sem nome')
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({ message });
    }
  }

  @Get('referencias-dados')
  async getReferences(
    @TenantId() tenantId: string | null,
    @Res() res: Response,
  ) {
    try {
      const referencias = await this.referenciasService.getReferences(
        tenantId,
      );
      return res.json({ referencias });
    } catch (error) {
      console.error('Erro ao obter referências:', (error as Error).message);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'Erro ao obter referências!' });
    }
  }

  @Delete('delete-referencia/:id')
  @Roles(...TENANT_ELEVATED)
  @HttpCode(HttpStatus.OK)
  async deleteReference(
    @Param('id') id: string,
    @TenantId() tenantId: string | null,
    @Res() res: Response,
  ) {
    try {
      await this.referenciasService.deleteReference(id, tenantId);
      return res
        .status(HttpStatus.OK)
        .json({ message: 'Referência deletada com sucesso!' });
    } catch (error) {
      const message = (error as Error).message;
      console.error('Erro ao deletar referência:', message);
      const status = message.includes('encontrada')
        ? HttpStatus.NOT_FOUND
        : HttpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({ message });
    }
  }
}
