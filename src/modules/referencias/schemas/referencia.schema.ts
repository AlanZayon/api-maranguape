import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReferenceDocument = HydratedDocument<Reference>;

@Schema()
export class Reference {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  cargo?: string;

  @Prop({ trim: true })
  telefone?: string;

  @Prop({
    type: String,
    enum: ['funcionario', 'externa'],
    default: 'externa',
    index: true,
  })
  origem!: string;

  @Prop({ type: Types.ObjectId, ref: 'Funcionario' })
  funcionarioId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenantId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;
}

export const ReferenceSchema = SchemaFactory.createForClass(Reference);
ReferenceSchema.index({ tenantId: 1, name: 1 }, { unique: true });
// Unique only when linked to a funcionario — sparse alone is not enough because
// tenantId is always present, so Mongo still indexes { tenantId, funcionarioId: null }.
ReferenceSchema.index(
  { tenantId: 1, funcionarioId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      funcionarioId: { $exists: true, $type: 'objectId' },
    },
  },
);

/** Alias used by Nest modules */
export { Reference as Referencia };
export const ReferenciaSchema = ReferenceSchema;
