import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { TENANT_ELEVATED, AuthUser } from '../../common/constants/roles';
import { CargosComissionadosService } from './cargos-comissionados.service';
import { CreateCargoComissionadoDto } from './dto/create-cargo-comissionado.dto';

const xlsxFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const name = (file.originalname || '').toLowerCase();
  if (
    name.endsWith('.xlsx') ||
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/octet-stream'
  ) {
    return cb(null, true);
  }
  return cb(new Error('Apenas arquivos .xlsx são permitidos.'), false);
};

@Controller('api/cargos-comissionados')
@UseGuards(AuthGuard, RolesGuard)
export class CargosComissionadosController {
  constructor(
    private readonly cargosComissionadosService: CargosComissionadosService,
  ) {}

  @Get()
  async listar(@TenantId() tenantId: string | null) {
    return this.cargosComissionadosService.listarCargos(tenantId);
  }

  @Get('template')
  @Roles(...TENANT_ELEVATED)
  template(@Res() res: Response) {
    const buffer = this.cargosComissionadosService.gerarTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="modelo-cargos-comissionados.xlsx"',
    );
    res.status(200).send(buffer);
  }

  @Post('import')
  @Roles(...TENANT_ELEVATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: xlsxFileFilter,
    }),
  )
  async importar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Envie um arquivo .xlsx no campo file.');
    }
    return this.cargosComissionadosService.importarPlanilha(file.buffer, {
      tenantId,
      userId: user?.id || null,
    });
  }

  @Post()
  @Roles(...TENANT_ELEVATED)
  async criar(
    @Body() body: CreateCargoComissionadoDto,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.cargosComissionadosService.criar(body, {
      tenantId,
      userId: user?.id || null,
    });
  }

  @Put(':id')
  @Roles(...TENANT_ELEVATED)
  async atualizar(
    @Param('id') id: string,
    @Body() body: CreateCargoComissionadoDto,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.cargosComissionadosService.atualizar(id, body, {
      tenantId,
      userId: user?.id || null,
    });
  }

  @Delete(':id')
  @Roles(...TENANT_ELEVATED)
  async remover(
    @Param('id') id: string,
    @TenantId() tenantId: string | null,
  ) {
    return this.cargosComissionadosService.remover(id, { tenantId });
  }
}
