import { Module } from '@nestjs/common';
import { MetricsMiddleware } from './metrics.middleware';

/**
 * Owns the single `MetricsMiddleware` instance shared by `main.ts` (hooked
 * as global middleware via `app.use`) and `HealthController` (reads the
 * snapshot for GET /metrics). Import this module wherever the same
 * singleton instance needs to be injected.
 */
@Module({
  providers: [MetricsMiddleware],
  exports: [MetricsMiddleware],
})
export class MetricsModule {}
