import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CargoComissionadoDocument = HydratedDocument<CargoComissionado>;

@Schema()
export class CargoComissionado {
  @Prop({ required: true, trim: true })
  tipo!: string;

  @Prop({ required: true, trim: true })
  cargo!: string;

  @Prop({ required: true, trim: true })
  simbologia!: string;

  @Prop({ required: true })
  aDefinir!: number;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenantId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;
}

export const CargoComissionadoSchema =
  SchemaFactory.createForClass(CargoComissionado);
CargoComissionadoSchema.index({ tenantId: 1, cargo: 1 }, { unique: true });
