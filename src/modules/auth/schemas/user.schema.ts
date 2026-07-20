import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  username!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({
    type: String,
    enum: ['owner', 'admin', 'user', 'readonly', 'superadmin'],
    default: 'user',
  })
  role!: string;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenantId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  lastValidToken!: string | null;

  @Prop({ type: Date, default: null })
  tokenExpiresAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;

  comparePassword!: (inputPassword: string) => Promise<boolean>;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { tenantId: 1, username: 1 },
  {
    unique: true,
    partialFilterExpression: { username: { $type: 'string' } },
  },
);

UserSchema.methods.comparePassword = async function (
  this: UserDocument,
  inputPassword: string,
) {
  return bcrypt.compare(inputPassword, this.passwordHash);
};
