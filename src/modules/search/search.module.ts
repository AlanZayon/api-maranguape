import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../../database/database.module';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchRepository } from './search.repository';

@Module({
  imports: [
    // Provides Funcionario + Setor models (registered via forFeature in DatabaseModule).
    DatabaseModule,
    MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]),
  ],
  controllers: [SearchController],
  providers: [SearchService, SearchRepository, AuthGuard],
  exports: [SearchService],
})
export class SearchModule {}
