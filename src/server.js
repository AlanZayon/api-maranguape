const app = require('./app');
const { syncIndexes } = require('./scripts/syncIndexes');
const { startBulkWorker } = require('./workers/bulkWorker');

// Porta do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// Non-blocking index sync (safe to retry on every boot)
syncIndexes().catch((err) => {
  console.error('Falha ao sincronizar índices no boot:', err.message);
});

// BullMQ worker for bulk delete/export (>200 IDs).
// Set BULK_WORKER_EMBEDDED=false to run only via `npm run worker:bulk`.
if (process.env.BULK_WORKER_EMBEDDED !== 'false') {
  try {
    startBulkWorker();
  } catch (err) {
    console.error('Falha ao iniciar bulk worker:', err.message);
  }
}
