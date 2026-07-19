const { Worker } = require('bullmq');
const {
  BULK_QUEUE_NAME,
  connection,
} = require('../queues/bulkQueue');

let worker = null;

function createBulkWorker() {
  // Lazy-require to avoid circular deps at module load
  const FuncionarioService = require('../services/funcionariosService');

  return new Worker(
    BULK_QUEUE_NAME,
    async (job) => {
      const tenantId = job.data?.tenantId || null;

      if (job.name === 'delete-users') {
        const userIds = job.data?.userIds || [];
        await job.updateProgress(10);
        await FuncionarioService.deleteUsers(userIds, tenantId);
        await job.updateProgress(100);
        return { deleted: userIds.length };
      }

      if (job.name === 'export-csv') {
        const ids = job.data?.ids || [];
        await job.updateProgress(10);
        const csv = await FuncionarioService.exportCsv(tenantId, ids);
        await job.updateProgress(100);
        return { csv, count: ids.length };
      }

      throw new Error(`Unknown job type: ${job.name}`);
    },
    {
      connection,
      concurrency: 2,
    }
  );
}

function startBulkWorker() {
  if (worker) return worker;

  worker = createBulkWorker();

  worker.on('completed', (job) => {
    console.log(`[bulk-worker] job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[bulk-worker] job ${job?.id} (${job?.name}) failed:`,
      err.message
    );
  });

  console.log('[bulk-worker] listening on queue', BULK_QUEUE_NAME);
  return worker;
}

async function stopBulkWorker() {
  if (!worker) return;
  await worker.close();
  worker = null;
}

module.exports = {
  startBulkWorker,
  stopBulkWorker,
  createBulkWorker,
};

if (require.main === module) {
  require('dotenv').config();
  // Ensure Mongo models register their connection
  require('../models/funcionariosSchema');
  startBulkWorker();
  console.log('[bulk-worker] started as standalone process');
}
