import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({ _id: false })
export class Branding {
  @Prop({ type: String, default: null })
  logoUrl!: string | null;

  @Prop({ type: String, default: null })
  faviconUrl!: string | null;

  @Prop({ type: String, default: null })
  displayName!: string | null;

  @Prop({ type: String, default: '#1a5f2a' })
  primaryColor!: string;

  @Prop({ type: String, default: null })
  secondaryColor!: string | null;

  @Prop({ type: String, default: '#ffffff' })
  primaryContrast!: string;

  @Prop({ type: String, default: '#1b1f24' })
  headerBg!: string;

  @Prop({ type: String, default: '#f8f9fa' })
  headerText!: string;

  @Prop({ type: String, default: '#ffffff' })
  sidebarBg!: string;

  @Prop({ type: String, default: '#343a40' })
  sidebarText!: string;

  @Prop({ type: String, default: '#ffffff' })
  surfaceBg!: string;

  @Prop({ type: String, default: '#f3f4f6' })
  pageBg!: string;

  @Prop({ type: String, default: '#212529' })
  textColor!: string;

  @Prop({ type: String, default: '#6c757d' })
  mutedColor!: string;

  @Prop({ type: String, default: '#dee2e6' })
  borderColor!: string;

  @Prop({ type: String, default: null })
  fontFamily!: string | null;

  @Prop({ type: String, default: null })
  fontUrl!: string | null;

  @Prop({ type: String, enum: ['light', 'dark'], default: 'light' })
  themeMode!: string;

  @Prop({ type: String, default: null })
  customCss!: string | null;
}

export const BrandingSchema = SchemaFactory.createForClass(Branding);

@Schema({ timestamps: true })
export class Tenant {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  slug!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: BrandingSchema, default: () => ({}) })
  branding!: Branding;

  @Prop({
    type: {
      vocabulary: { type: Object, default: {} },
      seedOnCreate: { type: Boolean, default: true },
    },
    default: () => ({ vocabulary: {}, seedOnCreate: true }),
  })
  settings!: {
    vocabulary: Record<string, unknown>;
    seedOnCreate: boolean;
  };

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status!: string;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
