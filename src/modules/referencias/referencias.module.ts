import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferenciasController } from './referencias.controller';
import { ReferenciasService } from './referencias.service';
import { ReferenciasRepository } from './referencias.repository';
import { Reference, ReferenceSchema } from './schemas/referencia.schema';
import { Funcionario, FuncionarioSchema } from '../funcionarios/schemas/funcionario.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reference.name, schema: ReferenceSchema },
      { name: Funcionario.name, schema: FuncionarioSchema },
    ]),
  ],
  controllers: [ReferenciasController],
  providers: [ReferenciasService, ReferenciasRepository],
  exports: [ReferenciasService],
})
export class ReferenciasModule {}
