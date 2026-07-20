import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { IndexSyncService } from './index-sync.service';
import {
  Funcionario,
  FuncionarioSchema,
} from '../modules/funcionarios/schemas/funcionario.schema';
import {
  LimiteSimbologia,
  LimiteSimbologiaSchema,
} from '../modules/funcionarios/schemas/limite-simbologia.schema';
import { Setor, SetorSchema } from '../modules/setores/schemas/setor.schema';
import { Tenant, TenantSchema } from '../modules/tenants/schemas/tenant.schema';
import { User, UserSchema } from '../modules/auth/schemas/user.schema';
import {
  Reference,
  ReferenceSchema,
} from '../modules/referencias/schemas/referencia.schema';
import {
  AuditLog,
  AuditLogSchema,
} from '../modules/audit/schemas/audit-log.schema';
import {
  CargoComissionado,
  CargoComissionadoSchema,
} from '../modules/cargos-comissionados/schemas/cargo-comissionado.schema';

export const CARGO_MODEL = 'Cargocomissionado';
export const SIMBOLOGIA_MODEL = 'Simbologia';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_CONNECTING_FUNCIONARIOS'),
        serverSelectionTimeoutMS: 30000,
        maxPoolSize: 10,
      }),
    }),
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
      { name: Funcionario.name, schema: FuncionarioSchema },
      { name: Setor.name, schema: SetorSchema },
      { name: Reference.name, schema: ReferenceSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: CARGO_MODEL, schema: CargoComissionadoSchema },
      { name: SIMBOLOGIA_MODEL, schema: LimiteSimbologiaSchema },
    ]),
  ],
  providers: [IndexSyncService],
  exports: [MongooseModule],
})
export class DatabaseModule {}
