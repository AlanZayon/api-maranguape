import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { TENANT_ELEVATED, TENANT_STAFF, AuthUser } from '../../../common/constants/roles';
import { AppError } from '../../../common/errors/app-error';
import { BulkQueueService } from '../../../infrastructure/queue/bulk-queue.service';
import { BULK_SYNC_THRESHOLD } from '../../../infrastructure/queue/bulk-queue.constants';
import { FuncionariosService } from '../services/funcionarios.service';
import { CargoLookupRepository } from '../repositories/cargo-lookup.repository';
import { FuncionarioDto } from '../dto/funcionario.dto';
import {
  BuscarIdsDto,
  BuscarPorDivisoesDto,
  DeleteUsersDto,
  ExportCsvDto,
  UpdateLotacaoDto,
  UpdateObservacoesDto,
} from '../dto/bulk-actions.dto';
import { ListFilters } from '../types/list-filters.type';
import {
  FUNCIONARIOS_UPLOAD_FIELDS,
  funcionariosMulterOptions,
} from '../multer/funcionarios-multer.options';

type MulterFiles = {
  foto?: Express.Multer.File[];
  arquivo?: Express.Multer.File[];
};

function listFiltersFromQuery(query: Record<string, unknown> = {}): ListFilters {
  return {
    q: (query.q as string) || '',
    natureza: (query.natureza as string) || '',
    secretaria: (query.secretaria as string) || '',
    funcao: (query.funcao as string) || '',
    bairro: (query.bairro as string) || '',
    referencia: (query.referencia as string) || '',
  };
}

function listFiltersFromBody(body: Record<string, unknown> = {}): ListFilters {
  return {
    q: (body.q as string) || '',
    natureza: (body.natureza as string) || '',
    secretaria: (body.secretaria as string) || '',
    funcao: (body.funcao as string) || '',
    bairro: (body.bairro as string) || '',
    referencia: (body.referencia as string) || '',
  };
}

/**
 * Ported from legacy/routes/funcionariosRoutes.js + funcionariosController.js.
 */
@Controller('api/funcionarios')
@UseGuards(AuthGuard, RolesGuard)
export class FuncionariosController {
  constructor(
    private readonly funcionariosService: FuncionariosService,
    private readonly bulkQueueService: BulkQueueService,
    private readonly cargoLookup: CargoLookupRepository,
  ) {}

  @Get('buscarFuncionarios')
  async buscarFuncionarios(
    @Query() query: Record<string, unknown>,
    @TenantId() tenantId: string | null,
  ) {
    const page = parseInt(String(query.page), 10) || 1;
    const limit = parseInt(String(query.limit), 10) || 50;
    return this.funcionariosService.buscarFuncionarios(
      page,
      limit,
      tenantId,
      listFiltersFromQuery(query),
    );
  }

  @Get('para-selecao')
  async buscarParaSelecao(
    @Query() query: Record<string, unknown>,
    @TenantId() tenantId: string | null,
  ) {
    const incluirFiltros =
      query.incluirFiltros === '1' ||
      query.incluirFiltros === 'true' ||
      query.page === undefined ||
      String(query.page) === '1';

    return this.funcionariosService.buscarParaSelecao(
      {
        q: (query.q as string) || '',
        natureza: (query.natureza as string) || '',
        secretaria: (query.secretaria as string) || '',
        funcao: (query.funcao as string) || '',
        page: (query.page as string) || 1,
        limit: (query.limit as string) || 15,
        incluirFiltros,
      },
      tenantId,
    );
  }

  @Get('filtros-disponiveis')
  async getFiltrosDisponiveis(@TenantId() tenantId: string | null) {
    return this.funcionariosService.getFiltrosDisponiveis(tenantId);
  }

  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    const status = await this.bulkQueueService.getJobStatus(jobId);
    if (!status) {
      throw new AppError('Job não encontrado.', 404, 'NOT_FOUND');
    }
    return status;
  }

  @Get(':id/midia')
  async getMidia(@Param('id') id: string, @TenantId() tenantId: string | null) {
    return this.funcionariosService.getMidiaUrls(id, tenantId);
  }

  @Post('ids')
  @Roles(...TENANT_STAFF)
  @UsePipes(new ValidationPipe({ transform: true }))
  async buscarIds(@Body() body: BuscarIdsDto, @TenantId() tenantId: string | null) {
    return this.funcionariosService.buscarIds(
      {
        filters: listFiltersFromBody(body as unknown as Record<string, unknown>),
        setorIds: Array.isArray(body.ids) ? body.ids : body.setorIds || null,
        subtreeRoot: body.subtreeRoot || null,
        max: body.max || 10000,
      },
      tenantId,
    );
  }

  @Get('buscarFuncionariosPorCoordenadoria/:coordId')
  async buscarFuncionariosPorCoordenadoria(
    @Param('coordId') coordId: string,
    @Query() query: Record<string, unknown>,
    @TenantId() tenantId: string | null,
  ) {
    const page = parseInt(String(query.page), 10) || 1;
    const limit = parseInt(String(query.limit), 10) || 50;
    return this.funcionariosService.buscarFuncionariosPorCoordenadoria(
      coordId,
      page,
      limit,
      tenantId,
      listFiltersFromQuery(query),
    );
  }

  /** Alias: `setorId` maps onto the same handler as `coordId`. */
  @Get('buscarFuncionariosPorSetorId/:setorId')
  async buscarFuncionariosPorSetorIdAlias(
    @Param('setorId') setorId: string,
    @Query() query: Record<string, unknown>,
    @TenantId() tenantId: string | null,
  ) {
    return this.buscarFuncionariosPorCoordenadoria(setorId, query, tenantId);
  }

  @Get('setores/:idSetor/funcionarios')
  async buscarFuncionariosPorSetor(
    @Param('idSetor') idSetor: string,
    @Query() query: Record<string, unknown>,
    @TenantId() tenantId: string | null,
  ) {
    const page = parseInt(String(query.page), 10) || 1;
    const limit = parseInt(String(query.limit), 10) || 50;
    return this.funcionariosService.buscarFuncionariosPorSetor(
      idSetor,
      page,
      limit,
      tenantId,
      listFiltersFromQuery(query),
    );
  }

  @Post()
  @Roles(...TENANT_STAFF)
  @UseInterceptors(
    FileFieldsInterceptor(FUNCIONARIOS_UPLOAD_FIELDS, funcionariosMulterOptions),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  async createFuncionario(
    @Body() body: FuncionarioDto,
    @UploadedFiles() files: MulterFiles,
    @TenantId() tenantId: string | null,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    try {
      return await this.funcionariosService.createFuncionario(
        body,
        files,
        tenantId,
        user?.id || null,
      );
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        throw new AppError(
          'Já existe um funcionário com esse nome ou outro campo único.',
          400,
          'DUPLICATE_KEY',
        );
      }
      throw error;
    }
  }

  @Put('edit-funcionario/:id')
  @Roles(...TENANT_STAFF)
  @UseInterceptors(
    FileFieldsInterceptor(FUNCIONARIOS_UPLOAD_FIELDS, funcionariosMulterOptions),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateFuncionario(
    @Param('id') id: string,
    @Body() body: FuncionarioDto,
    @UploadedFiles() files: MulterFiles,
    @TenantId() tenantId: string | null,
  ) {
    const response = await this.funcionariosService.updateFuncionario(
      id,
      body,
      files,
      tenantId,
      null,
    );
    return response.data;
  }

  @Delete('delete-users')
  @HttpCode(200)
  @Roles(...TENANT_ELEVATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async deleteUsers(
    @Body() body: DeleteUsersDto,
    @TenantId() tenantId: string | null,
  ) {
    const { userIds } = body;

    if (userIds.length > BULK_SYNC_THRESHOLD) {
      const job = await this.bulkQueueService.enqueueDeleteUsers({
        userIds,
        tenantId,
      });
      return { jobId: String(job.id), status: 'queued' };
    }

    return this.funcionariosService.deleteUsers(userIds, tenantId);
  }

  @Put('editar-coordenadoria-usuario')
  @Roles(...TENANT_STAFF)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateCoordenadoria(
    @Body() body: UpdateLotacaoDto,
    @TenantId() tenantId: string | null,
  ) {
    const destino = body.setorId || body.coordenadoriaId || body.lotacaoId;
    return this.funcionariosService.updateLotacao(
      body.usuariosIds,
      destino as string,
      tenantId,
    );
  }

  @Put('editar-lotacao-usuario')
  @Roles(...TENANT_STAFF)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateLotacao(
    @Body() body: UpdateLotacaoDto,
    @TenantId() tenantId: string | null,
  ) {
    return this.updateCoordenadoria(body, tenantId);
  }

  @Put('observacoes/:userId')
  @Roles(...TENANT_STAFF)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateObservacoes(
    @Param('userId') userId: string,
    @Body() body: UpdateObservacoesDto,
    @TenantId() tenantId: string | null,
  ) {
    const user = await this.funcionariosService.updateObservacoes(
      userId,
      body.observacoes || [],
      tenantId,
    );
    return {
      message: 'Observações atualizadas com sucesso.',
      observacoes: (user as unknown as { observacoes: unknown }).observacoes,
    };
  }

  @Get('buscarCargos')
  async buscarCargos(@TenantId() tenantId: string | null) {
    return this.cargoLookup.buscarTodos(tenantId);
  }

  @Get('check-name')
  async checkName(
    @Query('name') name: string,
    @TenantId() tenantId: string | null,
  ) {
    const result = await this.funcionariosService.checkNameAvailability(name, tenantId);
    return { available: result.available, message: result.message };
  }

  @Post('export/csv')
  @Roles(...TENANT_STAFF)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="funcionarios.csv"')
  @UsePipes(new ValidationPipe({ transform: true }))
  async exportCsv(@Body() body: ExportCsvDto, @TenantId() tenantId: string | null) {
    const ids = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length > BULK_SYNC_THRESHOLD) {
      const job = await this.bulkQueueService.enqueueExportCsv({ ids, tenantId });
      return { jobId: String(job.id), status: 'queued' };
    }

    return this.funcionariosService.exportCsv(tenantId, ids);
  }

  @Get(':id/has-funcionarios')
  async checkHasFuncionarios(@Param('id') id: string) {
    const hasEmployees = await this.funcionariosService.hasFuncionarios(id);
    return { hasEmployees };
  }

  @Post('por-divisoes')
  @UsePipes(new ValidationPipe({ transform: true }))
  async buscarFuncionariosPorDivisoes(
    @Body() body: BuscarPorDivisoesDto,
    @TenantId() tenantId: string | null,
  ) {
    const { ids, page, limit } = body;

    const idsArray = Array.isArray(ids)
      ? ids
      : typeof ids === 'string'
        ? ids.split(',').filter((id) => id.length > 0)
        : [];

    const pageNumber = parseInt(String(page), 10) || 1;
    const limitNumber = parseInt(String(limit), 10) || 50;

    return this.funcionariosService.buscarFuncionariosPorDivisoes(
      idsArray,
      pageNumber,
      limitNumber,
      tenantId,
      listFiltersFromBody(body as unknown as Record<string, unknown>),
    );
  }

  @Post('por-setores')
  @UsePipes(new ValidationPipe({ transform: true }))
  async buscarFuncionariosPorSetores(
    @Body() body: BuscarPorDivisoesDto,
    @TenantId() tenantId: string | null,
  ) {
    return this.buscarFuncionariosPorDivisoes(body, tenantId);
  }
}
