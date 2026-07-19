const { Queue } = require('bullmq');

const BULK_QUEUE_NAME = 'funcionarios-bulk';
const BULK_SYNC_THRESHOLD = 200;

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    return {
      url: `${process.env.REDIS_URL}?family=0`,
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    family: 4,
    maxRetriesPerRequest: null,
  };
}

const connection = getRedisConnection();

const bulkQueue = new Queue(BULK_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 500 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

async function enqueueDeleteUsers({ userIds, tenantId }) {
  return bulkQueue.add(
    'delete-users',
    { userIds, tenantId },
    { jobId: undefined }
  );
}

async function enqueueExportCsv({ ids, tenantId }) {
  return bulkQueue.add('export-csv', { ids, tenantId });
}

/**
 * Normalize BullMQ state to a stable API status.
 */
function mapJobStatus(state) {
  if (state === 'waiting' || state === 'delayed' || state === 'paused') {
    return 'queued';
  }
  if (state === 'active') return 'active';
  if (state === 'completed') return 'completed';
  if (state === 'failed') return 'failed';
  return state;
}

async function getJobStatus(jobId) {
  const job = await bulkQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const status = mapJobStatus(state);

  const payload = {
    jobId: String(job.id),
    name: job.name,
    status,
    progress: job.progress || 0,
  };

  if (status === 'completed') {
    payload.result = job.returnvalue;
  }
  if (status === 'failed') {
    payload.error = job.failedReason || 'Job failed';
  }

  return payload;
}

module.exports = {
  BULK_QUEUE_NAME,
  BULK_SYNC_THRESHOLD,
  connection,
  bulkQueue,
  getRedisConnection,
  enqueueDeleteUsers,
  enqueueExportCsv,
  getJobStatus,
};
