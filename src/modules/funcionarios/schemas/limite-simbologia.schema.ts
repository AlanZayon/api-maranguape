import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LimiteSimbologiaDocument = HydratedDocument<LimiteSimbologia>;

/** Legacy model name was `Simbologia` (db.model('Simbologia', ...)) — pin the
 * collection explicitly so the class rename doesn't change the Mongo collection. */
@Schema({ collection: 'simbologias' })
export class LimiteSimbologia {
  @Prop({ required: true })
  simbologia!: string;

  @Prop({ required: true })
  limite!: number;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenantId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;
}

export const LimiteSimbologiaSchema =
  SchemaFactory.createForClass(LimiteSimbologia);
LimiteSimbologiaSchema.index({ tenantId: 1, simbologia: 1 }, { unique: true });
