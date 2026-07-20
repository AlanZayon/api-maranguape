import { Module } from '@nestjs/common';
import { CargosComissionadosController } from './cargos-comissionados.controller';
import { CargosComissionadosService } from './cargos-comissionados.service';
import { CargosComissionadosRepository } from './cargos-comissionados.repository';

@Module({
  controllers: [CargosComissionadosController],
  providers: [CargosComissionadosService, CargosComissionadosRepository],
  exports: [CargosComissionadosService],
})
export class CargosComissionadosModule {}
