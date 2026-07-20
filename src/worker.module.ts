import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { BulkQueueModule } from './infrastructure/queue/bulk-queue.module';
import { FuncionariosModule } from './modules/funcionarios/funcionarios.module';

/**
 * Standalone worker context for `npm run worker:bulk`
 * when BULK_WORKER_EMBEDDED=false.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    CacheModule,
    BulkQueueModule.registerWorker(),
    FuncionariosModule,
  ],
})
export class WorkerModule {}
