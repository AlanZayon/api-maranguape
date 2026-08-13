import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { UpdateReferenceDto } from './dto/update-reference.dto';

function statusForMessage(message: string): HttpStatus {
  if (message.includes('encontrad')) return HttpStatus.NOT_FOUND;
  if (
    message.includes('obrigatór') ||
    message.includes('existe') ||
    message.includes('já está cadastrado') ||
    message.includes('sem nome') ||
    message.includes('Ciclo') ||
    message.includes('si mesma')
  ) {
    return HttpStatus.BAD_REQUEST;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

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
      return res.status(statusForMessage(message)).json({ message });
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

  @Get('arvore')
  async getTree(@TenantId() tenantId: string | null, @Res() res: Response) {
    try {
      const arvore = await this.referenciasService.getTree(tenantId);
      return res.json({ arvore });
    } catch (error) {
      console.error(
        'Erro ao montar árvore de referências:',
        (error as Error).message,
      );
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'Erro ao montar árvore de referências!' });
    }
  }

  @Get('funcionario/:funcionarioId/cadeia')
  async getFuncionarioChain(
    @Param('funcionarioId') funcionarioId: string,
    @TenantId() tenantId: string | null,
    @Res() res: Response,
  ) {
    try {
      const chain = await this.referenciasService.getFuncionarioChain(
        funcionarioId,
        tenantId,
      );
      return res.json(chain);
    } catch (error) {
      const message = (error as Error).message;
      console.error('Erro ao obter cadeia do funcionário:', message);
      return res.status(statusForMessage(message)).json({ message });
    }
  }

  @Get(':id/ancestrais')
  async getAncestors(
    @Param('id') id: string,
    @TenantId() tenantId: string | null,
    @Res() res: Response,
  ) {
    try {
      const chain = await this.referenciasService.getAncestors(id, tenantId);
      return res.json(chain);
    } catch (error) {
      const message = (error as Error).message;
      console.error('Erro ao obter ancestrais da referência:', message);
      return res.status(statusForMessage(message)).json({ message });
    }
  }

  @Get(':id/descendentes')
  async getDescendants(
    @Param('id') id: string,
    @TenantId() tenantId: string | null,
    @Res() res: Response,
  ) {
    try {
      const subtree = await this.referenciasService.getDescendants(
        id,
        tenantId,
      );
      return res.json(subtree);
    } catch (error) {
      const message = (error as Error).message;
      console.error('Erro ao obter descendentes da referência:', message);
      return res.status(statusForMessage(message)).json({ message });
    }
  }

  @Get(':id/impacto-exclusao')
  @Roles(...TENANT_ELEVATED)
  async getDeletionImpact(
    @Param('id') id: string,
    @TenantId() tenantId: string | null,
    @Res() res: Response,
  ) {
    try {
      const impact = await this.referenciasService.getDeletionImpact(
        id,
        tenantId,
      );
      return res.json(impact);
    } catch (error) {
      const message = (error as Error).message;
      console.error('Erro ao calcular impacto da exclusão:', message);
      return res.status(statusForMessage(message)).json({ message });
    }
  }

  @Patch(':id')
  @Roles(...TENANT_ELEVATED)
  async updateReference(
    @Param('id') id: string,
    @Body() body: UpdateReferenceDto,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
    @Res() res: Response,
  ) {
    try {
      const referencia = await this.referenciasService.updateReference(
        id,
        body,
        tenantId,
        user?.id || null,
      );
      return res.json({
        message: 'Referência atualizada com sucesso!',
        referencia,
      });
    } catch (error) {
      const message = (error as Error).message;
      console.error('Erro ao atualizar referência:', message);
      return res.status(statusForMessage(message)).json({ message });
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
      return res.status(statusForMessage(message)).json({ message });
    }
  }
}
