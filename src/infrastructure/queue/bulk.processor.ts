import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BULK_QUEUE_NAME } from './bulk-queue.constants';
import { FuncionariosService } from '../../modules/funcionarios/services/funcionarios.service';

type DeleteUsersJobData = { userIds: string[]; tenantId: string | null };
type ExportCsvJobData = { ids: string[]; tenantId: string | null };

/**
 * Ported from legacy/workers/bulkWorker.js.
 * Registered either embedded (AppModule, when BULK_WORKER_EMBEDDED=true)
 * or in the standalone worker process via BulkQueueModule.registerWorker().
 */
@Injectable()
@Processor(BULK_QUEUE_NAME, { concurrency: 2 })
export class BulkProcessor extends WorkerHost {
  private readonly logger = new Logger('bulk-worker');

  constructor(private readonly funcionariosService: FuncionariosService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === 'delete-users') {
      const data = job.data as DeleteUsersJobData;
      const userIds = data?.userIds || [];
      const tenantId = data?.tenantId ?? null;
      await job.updateProgress(10);
      await this.funcionariosService.deleteUsers(userIds, tenantId);
      await job.updateProgress(100);
      return { deleted: userIds.length };
    }

    if (job.name === 'export-csv') {
      const data = job.data as ExportCsvJobData;
      const ids = data?.ids || [];
      const tenantId = data?.tenantId ?? null;
      await job.updateProgress(10);
      const csv = await this.funcionariosService.exportCsv(tenantId, ids);
      await job.updateProgress(100);
      return { csv, count: ids.length };
    }

    throw new Error(`Unknown job type: ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`job ${job.id} (${job.name}) completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.error(
      `job ${job?.id} (${job?.name}) failed: ${err.message}`,
    );
  }
}
