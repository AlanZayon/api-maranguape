import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './env.validation';
import { BrandingPolicyService } from './branding-policy.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
  providers: [BrandingPolicyService, ConfigService],
  exports: [BrandingPolicyService, ConfigService],
})
export class AppConfigModule {}
