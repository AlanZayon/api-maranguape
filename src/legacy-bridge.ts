/**
 * Legacy Express mount bridge — retained for strangler rollback via NEST_MIGRATED.
 * With NEST_MIGRATED=all (default), nothing is mounted.
 */
import type { Express } from 'express';

export function mountLegacyRouters(
  _expressInstance: Express,
  migratedCsv: string,
): void {
  if (migratedCsv === 'all') {
    console.log('[legacy] NEST_MIGRATED=all — no Express routers mounted');
    return;
  }
  console.warn(
    '[legacy] Partial NEST_MIGRATED requested but src/legacy was removed. Set NEST_MIGRATED=all.',
  );
}

export function mountLegacyApp(expressInstance: Express): void {
  mountLegacyRouters(expressInstance, process.env.NEST_MIGRATED || 'all');
}
