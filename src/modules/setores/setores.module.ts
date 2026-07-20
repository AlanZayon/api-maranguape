import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SetoresController } from './setores.controller';
import { SetoresService } from './setores.service';
import { SetoresRepository } from './setores.repository';
import { AuditModule } from '../audit/audit.module';
import { Setor, SetorSchema } from './schemas/setor.schema';
import { Funcionario, FuncionarioSchema } from '../funcionarios/schemas/funcionario.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Setor.name, schema: SetorSchema },
      { name: Funcionario.name, schema: FuncionarioSchema },
    ]),
    AuditModule,
  ],
  controllers: [SetoresController],
  providers: [SetoresService, SetoresRepository],
  exports: [SetoresService, SetoresRepository],
})
export class SetoresModule {}
