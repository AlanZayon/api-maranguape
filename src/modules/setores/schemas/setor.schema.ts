import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SetorDocument = HydratedDocument<Setor>;

@Schema({ timestamps: false })
export class Setor {
  @Prop({ required: true })
  nome!: string;

  @Prop({ type: String, enum: ['Setor', 'Subsetor'], required: true })
  tipo!: string;

  @Prop({ type: Types.ObjectId, ref: 'Setor', default: null, index: true })
  parent!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenantId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;
}

export const SetorSchema = SchemaFactory.createForClass(Setor);
SetorSchema.index({ tenantId: 1, parent: 1 });
