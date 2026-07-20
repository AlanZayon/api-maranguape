import { Body, Controller, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { RelatorioService } from '../services/relatorio.service';
import { ObterDadosRelatorioDto } from '../dto/funcionario.dto';

/**
 * Ported from legacy/controllers/relatorioController.js
 * (mounted under `/api/funcionarios/relatorio-funcionarios` in funcionariosRoutes.js).
 */
@Controller('api/funcionarios/relatorio-funcionarios')
@UseGuards(AuthGuard)
export class RelatorioController {
  constructor(private readonly relatorioService: RelatorioService) {}

  @Post('dados')
  @UsePipes(new ValidationPipe({ transform: true }))
  async obterDados(
    @Body() body: ObterDadosRelatorioDto,
    @TenantId() tenantId: string | null,
  ) {
    const tipoRelatorio = body.tipo || 'geral';
    return this.relatorioService.obterDadosRelatorio(
      body.ids || [],
      tipoRelatorio,
      tenantId,
    );
  }
}
