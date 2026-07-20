import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenantId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  action!: string;

  @Prop({ required: true, trim: true })
  entity!: string;

  @Prop({ type: String, default: null })
  entityId!: string | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta!: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
