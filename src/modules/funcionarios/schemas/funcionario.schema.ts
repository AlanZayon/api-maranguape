import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type FuncionarioDocument = HydratedDocument<Funcionario>;

@Schema({ _id: false })
export class RedeSocial {
  @Prop()
  link?: string;

  @Prop()
  nome?: string;
}

@Schema({ timestamps: false })
export class Funcionario {
  @Prop({ required: true })
  nome!: string;

  @Prop({ type: String, default: null })
  foto!: string | null;

  @Prop({ required: true })
  secretaria!: string;

  @Prop({ required: true })
  funcao!: string;

  @Prop()
  tipo?: string;

  @Prop({ required: true })
  natureza!: string;

  @Prop()
  referencia?: string;

  @Prop({ type: [Object], default: [] })
  redesSociais!: RedeSocial[];

  @Prop({ required: true })
  salarioBruto!: number;

  @Prop()
  endereco?: string;

  @Prop()
  cidade?: string;

  @Prop()
  bairro?: string;

  @Prop()
  telefone?: string;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  observacoes!: unknown[];

  @Prop({ type: String, default: null })
  arquivo!: string | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'Setor',
    required: true,
    index: true,
  })
  setorId!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  inicioContrato!: Date | null;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: null,
  })
  fimContrato!: Date | string | null;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenantId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;
}

export const FuncionarioSchema = SchemaFactory.createForClass(Funcionario);

FuncionarioSchema.path('fimContrato').set(function (value: unknown) {
  return value === '' ? null : value;
});

FuncionarioSchema.path('fimContrato').validate(function (value: unknown) {
  return (
    value === null ||
    value instanceof Date ||
    value === 'indeterminado'
  );
}, 'fimContrato deve ser uma data válida ou "indeterminado"');

FuncionarioSchema.index({ tenantId: 1, nome: 1 }, { unique: true });
FuncionarioSchema.index({ tenantId: 1, setorId: 1 });
FuncionarioSchema.index({ tenantId: 1, fimContrato: 1 });
FuncionarioSchema.index({ tenantId: 1, natureza: 1 });
