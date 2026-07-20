import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BULK_QUEUE_NAME } from './bulk-queue.constants';

export type BulkJobName = 'delete-users' | 'export-csv';

export type BulkJobStatus = {
  jobId: string;
  name: string;
  status: 'queued' | 'active' | 'completed' | 'failed' | string;
  progress: number | object | string | boolean;
  result?: unknown;
  error?: string;
};

/**
 * Producer-side API for the `funcionarios-bulk` queue.
 * Ported from legacy/queues/bulkQueue.js.
 */
@Injectable()
export class BulkQueueService {
  constructor(
    @InjectQueue(BULK_QUEUE_NAME) private readonly queue: Queue,
  ) {}

  async enqueueDeleteUsers(params: {
    userIds: string[];
    tenantId: string | null;
  }) {
    return this.queue.add('delete-users', params);
  }

  async enqueueExportCsv(params: { ids: string[]; tenantId: string | null }) {
    return this.queue.add('export-csv', params);
  }

  private mapJobStatus(state: string): string {
    if (state === 'waiting' || state === 'delayed' || state === 'paused') {
      return 'queued';
    }
    if (state === 'active') return 'active';
    if (state === 'completed') return 'completed';
    if (state === 'failed') return 'failed';
    return state;
  }

  async getJobStatus(jobId: string): Promise<BulkJobStatus | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const status = this.mapJobStatus(state);

    const payload: BulkJobStatus = {
      jobId: String(job.id),
      name: job.name,
      status,
      progress: (job.progress || 0) as number | object,
    };

    if (status === 'completed') {
      payload.result = job.returnvalue;
    }
    if (status === 'failed') {
      payload.error = job.failedReason || 'Job failed';
    }

    return payload;
  }
}
