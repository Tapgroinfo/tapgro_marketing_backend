import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';
import { SOCIAL_PROVIDERS } from '../../utils/platform.constants';

export type SystemSettingsDocument = HydratedDocument<SystemSettings>;

@Schema({ _id: false })
export class CompanySettings {
  @Prop({ type: String, default: 'TapGro' })
  name: string;

  @Prop({ type: String, default: '' })
  address: string;

  @Prop({ type: String, default: '' })
  city: string;

  @Prop({ type: String, default: '' })
  state: string;

  @Prop({ type: String, default: '' })
  pincode: string;

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ type: String, default: '' })
  email: string;

  @Prop({ type: String, default: '' })
  gstNumber: string;

  @Prop({ type: String, default: '' })
  panNumber: string;

  @Prop({ type: String, default: '' })
  websiteUrl: string;
}

/** SMTP / outbound email. */
@Schema({ _id: false })
export class EmailSmtpSettings {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: String, default: '' })
  host: string;

  @Prop({ type: Number, default: 587 })
  port: number;

  @Prop({ type: Boolean, default: false })
  secure: boolean;

  @Prop({ type: String, default: '' })
  username: string;

  @Prop({ type: String, default: '' })
  password: string;

  @Prop({ type: String, default: '' })
  fromName: string;

  @Prop({ type: String, default: '' })
  fromEmail: string;
}

/** Privacy Policy and Terms (HTML), served on public legal APIs. */
@Schema({ _id: false })
export class LegalSettings {
  @Prop({ type: String, default: '' })
  privacyPolicyHtml: string;

  @Prop({ type: String, default: '' })
  termsAndConditionsHtml: string;

  @Prop({ type: String, default: '' })
  privacyPolicyUpdatedAt: string;

  @Prop({ type: String, default: '' })
  termsAndConditionsUpdatedAt: string;
}

/** Third-party social media API (Zernio / Ayrshare) used to reach platforms. */
@Schema({ _id: false })
export class SocialProviderSettings {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: String, enum: [...SOCIAL_PROVIDERS], default: 'zernio' })
  provider: string;

  @Prop({ type: String, default: '' })
  apiKey: string;

  @Prop({ type: String, default: '' })
  webhookSecret: string;

  /** Optional override of the provider's default API base URL. */
  @Prop({ type: String, default: '' })
  apiBaseUrl: string;
}

export const CompanySettingsSchema =
  SchemaFactory.createForClass(CompanySettings);
export const EmailSmtpSettingsSchema =
  SchemaFactory.createForClass(EmailSmtpSettings);
export const LegalSettingsSchema = SchemaFactory.createForClass(LegalSettings);
export const SocialProviderSettingsSchema = SchemaFactory.createForClass(
  SocialProviderSettings,
);

/** Singleton document — platform-wide configuration. */
@Schema({ timestamps: true })
export class SystemSettings {
  @Prop({ type: String, default: 'default', unique: true })
  key: string;

  @Prop({ type: CompanySettingsSchema, default: () => ({}) })
  company: CompanySettings;

  @Prop({ type: EmailSmtpSettingsSchema, default: () => ({}) })
  email: EmailSmtpSettings;

  @Prop({ type: LegalSettingsSchema, default: () => ({}) })
  legal: LegalSettings;

  @Prop({ type: SocialProviderSettingsSchema, default: () => ({}) })
  socialProvider: SocialProviderSettings;
}

export const SystemSettingsSchema =
  SchemaFactory.createForClass(SystemSettings);
SystemSettingsSchema.set('toJSON', mongooseTransform.toJSON);
SystemSettingsSchema.set('toObject', mongooseTransform.toObject);
