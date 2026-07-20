import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Funcionario } from '../modules/funcionarios/schemas/funcionario.schema';
import { Setor } from '../modules/setores/schemas/setor.schema';
import { Reference } from '../modules/referencias/schemas/referencia.schema';

@Injectable()
export class IndexSyncService implements OnModuleInit {
  private readonly logger = new Logger(IndexSyncService.name);

  constructor(
    @InjectModel(Funcionario.name)
    private readonly funcionarioModel: Model<Funcionario>,
    @InjectModel(Setor.name) private readonly setorModel: Model<Setor>,
    @InjectModel(Reference.name)
    private readonly referenceModel: Model<Reference>,
  ) {}

  onModuleInit() {
    void this.sync().catch((err: Error) => {
      this.logger.error(`Falha ao sincronizar índices: ${err.message}`);
    });
  }

  async sync() {
    // Drop legacy unique indexes that blocked multiple externa refs (null funcionarioId).
    for (const indexName of [
      'tenantId_1_funcionarioId_1',
      'funcionarioId_1',
    ]) {
      try {
        await this.referenceModel.collection.dropIndex(indexName);
        this.logger.log(`Índice legado ${indexName} removido`);
      } catch (err) {
        const code = (err as { code?: number | string })?.code;
        if (code !== 27 && code !== 'IndexNotFound') {
          this.logger.warn(
            `Não foi possível remover índice ${indexName}: ${(err as Error).message}`,
          );
        }
      }
    }

    await Promise.all([
      this.funcionarioModel.syncIndexes(),
      this.setorModel.syncIndexes(),
      this.referenceModel.syncIndexes(),
    ]);
    this.logger.log('Índices sincronizados (Funcionario, Setor, Reference)');
  }
}
