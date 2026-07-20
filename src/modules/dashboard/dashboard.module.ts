import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';
import { SetoresModule } from '../setores/setores.module';
import { Funcionario, FuncionarioSchema } from '../funcionarios/schemas/funcionario.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Funcionario.name, schema: FuncionarioSchema },
    ]),
    SetoresModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
  exports: [DashboardService],
})
export class DashboardModule {}
