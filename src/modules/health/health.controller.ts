import { Controller, Get } from '@nestjs/common';
import { MetricsMiddleware } from '../../common/middleware/metrics.middleware';

/** Ports the health/metrics routes previously inlined in legacy/app.js. */
@Controller()
export class HealthController {
  constructor(private readonly metrics: MetricsMiddleware) {}

  @Get()
  root() {
    return { status: 'ok', service: 'api-organograma' };
  }

  @Get('health')
  health() {
    return { status: 'healthy', uptime: process.uptime() };
  }

  @Get('metrics')
  metricsSnapshot() {
    return this.metrics.getSnapshot();
  }
}
