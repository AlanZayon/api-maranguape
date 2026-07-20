import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { BrandingPolicyService } from '../../config/branding-policy.service';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
      { name: Setor.name, schema: SetorSchema },
    ]),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, BrandingPolicyService],
  exports: [TenantsService],
})
export class TenantsModule {}
