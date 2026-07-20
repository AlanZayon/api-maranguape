import { Module } from '@nestjs/common';
import { MetricsModule } from '../../common/middleware/metrics.module';
import { HealthController } from './health.controller';

@Module({
  imports: [MetricsModule],
  controllers: [HealthController],
})
export class HealthModule {}
