import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.validation';
import { BrandingPolicyService } from './config/branding-policy.service';
import { MetricsModule } from './common/middleware/metrics.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { S3Module } from './infrastructure/s3/s3.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { BulkQueueModule } from './infrastructure/queue/bulk-queue.module';
import { TokenCleanupService } from './common/services/token-cleanup.service';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReferenciasModule } from './modules/referencias/referencias.module';
import { SetoresModule } from './modules/setores/setores.module';
import { CargosComissionadosModule } from './modules/cargos-comissionados/cargos-comissionados.module';
import { FuncionariosModule } from './modules/funcionarios/funcionarios.module';
import { SearchModule } from './modules/search/search.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { NestModule, MiddlewareConsumer } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    MetricsModule,
    DatabaseModule,
    RedisModule,
    S3Module,
    CacheModule,
    BulkQueueModule,
    HealthModule,
    AuthModule,
    AuditModule,
    ReferenciasModule,
    SetoresModule,
    CargosComissionadosModule,
    FuncionariosModule,
    SearchModule,
    TenantsModule,
    DashboardModule,
  ],
  providers: [BrandingPolicyService, TenantMiddleware, TokenCleanupService],
  exports: [BrandingPolicyService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('{*path}');
  }
}
