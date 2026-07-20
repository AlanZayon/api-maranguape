import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../../database/database.module';
import { BulkQueueModule } from '../../infrastructure/queue/bulk-queue.module';
import {
  CargoComissionado,
  CargoComissionadoSchema,
} from '../cargos-comissionados/schemas/cargo-comissionado.schema';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';
import {
  LimiteSimbologia,
  LimiteSimbologiaSchema,
} from './schemas/limite-simbologia.schema';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FuncionariosController } from './controllers/funcionarios.controller';
import { RelatorioController } from './controllers/relatorio.controller';
import { FuncionariosService } from './services/funcionarios.service';
import { RelatorioService } from './services/relatorio.service';
import { LimiteService } from './services/limite.service';
import { FuncionariosRepository } from './repositories/funcionarios.repository';
import { CargoLookupRepository } from './repositories/cargo-lookup.repository';

@Module({
  imports: [
    // Provides Funcionario + Setor models (registered via forFeature in DatabaseModule).
    DatabaseModule,
    MongooseModule.forFeature([
      { name: CargoComissionado.name, schema: CargoComissionadoSchema },
      { name: LimiteSimbologia.name, schema: LimiteSimbologiaSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
    // Producer side (BulkQueueService) — forwardRef because BulkQueueModule
    // (embedded worker mode) imports this module back for BulkProcessor.
    forwardRef(() => BulkQueueModule),
  ],
  controllers: [FuncionariosController, RelatorioController],
  providers: [
    FuncionariosService,
    FuncionariosRepository,
    CargoLookupRepository,
    LimiteService,
    RelatorioService,
    AuthGuard,
    RolesGuard,
  ],
  exports: [FuncionariosService, FuncionariosRepository],
})
export class FuncionariosModule {}
