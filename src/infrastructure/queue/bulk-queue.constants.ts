export const BULK_QUEUE_NAME = 'funcionarios-bulk';

/**
 * Above this many affected records, mutating endpoints enqueue a background
 * job instead of running synchronously in the request/response cycle.
 */
export const BULK_SYNC_THRESHOLD = 200;
