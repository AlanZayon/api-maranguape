import { DynamicModule, Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QueueOptions } from 'bullmq';
import { BULK_QUEUE_NAME } from './bulk-queue.constants';
import { BulkQueueService } from './bulk-queue.service';
import { BulkProcessor } from './bulk.processor';
import { FuncionariosModule } from '../../modules/funcionarios/funcionarios.module';

/** Mirrors legacy/queues/bulkQueue.js `getRedisConnection`. */
function buildConnectionOptions(config: ConfigService): QueueOptions['connection'] {
  const url = config.get<string>('REDIS_URL');
  if (url) {
    return { url: `${url}?family=0`, maxRetriesPerRequest: null } as QueueOptions['connection'];
  }
  return {
    host: config.get<string>('REDIS_HOST') || '127.0.0.1',
    port: Number(config.get<string>('REDIS_PORT')) || 6379,
    family: 4,
    maxRetriesPerRequest: null,
  } as QueueOptions['connection'];
}

function buildQueueImports() {
  return [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: buildConnectionOptions(config),
      }),
    }),
    BullModule.registerQueue({
      name: BULK_QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 200 },
        removeOnFail: { age: 86400, count: 500 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
  ];
}

const embeddedWorker =
  String(process.env.BULK_WORKER_EMBEDDED).toLowerCase() === 'true';

/**
 * Producer-side module (queue registration + `BulkQueueService`).
 *
 * When `BULK_WORKER_EMBEDDED=true`, the bull processor (consumer) is also
 * registered here so the main API process runs the worker in-process.
 * When it is `false` (default), run the standalone worker process
 * (`npm run worker:bulk`) which imports `BulkQueueModule.registerWorker()`
 * from `WorkerModule` instead.
 */
@Module({
  imports: [
    ...buildQueueImports(),
    ...(embeddedWorker ? [forwardRef(() => FuncionariosModule)] : []),
  ],
  providers: [BulkQueueService, ...(embeddedWorker ? [BulkProcessor] : [])],
  exports: [BulkQueueService],
})
export class BulkQueueModule {
  /** Always registers the processor — used by the standalone worker process. */
  static registerWorker(): DynamicModule {
    return {
      module: BulkQueueModule,
      imports: [...buildQueueImports(), forwardRef(() => FuncionariosModule)],
      providers: [BulkQueueService, BulkProcessor],
      exports: [BulkQueueService],
    };
  }
}
