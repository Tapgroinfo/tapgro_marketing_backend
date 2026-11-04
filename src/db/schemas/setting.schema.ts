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

/** SMS gateway (SmartPing-style HTTP GET with DLT ids). */
@Schema({ _id: false })
export class SmsGatewaySettings {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: String, default: '' })
  username: string;

  @Prop({ type: String, default: '' })
  password: string;

  @Prop({ type: String, default: '' })
  senderId: string;

  @Prop({ type: String, default: '' })
  endpoint: string;

  @Prop({ type: String, default: '' })
  dltPrincipalEntityId: string;

  @Prop({ type: String, default: '' })
  dltTelemarketerId: string;
}

/** WhatsApp Business template API (Mehery-style). */
@Schema({ _id: false })
export class WhatsappGatewaySettings {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: String, default: '' })
  apiKey: string;

  @Prop({ type: String, default: '' })
  apiId: string;

  @Prop({ type: String, default: '' })
  channelId: string;

  @Prop({ type: String, default: '' })
  endpoint: string;
}

/** General app behaviour shown to clients via public settings. */
@Schema({ _id: false })
export class SystemConfigSettings {
  @Prop({ type: Boolean, default: false })
  maintenanceMode: boolean;

  @Prop({ type: String, default: '' })
  maintenanceMessage: string;

  @Prop({ type: String, default: 'Asia/Kolkata' })
  timezone: string;

  @Prop({ type: String, default: 'INR' })
  currency: string;

  @Prop({ type: String, default: '₹' })
  currencySymbol: string;

  @Prop({ type: String, default: 'DD/MM/YYYY' })
  dateFormat: string;

  @Prop({ type: String, default: '1.0.0' })
  androidVersion: string;

  @Prop({ type: String, default: '1.0.0' })
  iosVersion: string;

  @Prop({ type: Boolean, default: false })
  forceUpdate: boolean;

  @Prop({ type: String, default: '' })
  playStoreUrl: string;

  @Prop({ type: String, default: '' })
  appStoreUrl: string;
}

export const SmsGatewaySettingsSchema =
  SchemaFactory.createForClass(SmsGatewaySettings);
export const WhatsappGatewaySettingsSchema = SchemaFactory.createForClass(
  WhatsappGatewaySettings,
);
export const SystemConfigSettingsSchema =
  SchemaFactory.createForClass(SystemConfigSettings);
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

  @Prop({ type: SmsGatewaySettingsSchema, default: () => ({}) })
  sms: SmsGatewaySettings;

  @Prop({ type: WhatsappGatewaySettingsSchema, default: () => ({}) })
  whatsapp: WhatsappGatewaySettings;

  @Prop({ type: SystemConfigSettingsSchema, default: () => ({}) })
  system: SystemConfigSettings;
}

export const SystemSettingsSchema =
  SchemaFactory.createForClass(SystemSettings);
SystemSettingsSchema.set('toJSON', mongooseTransform.toJSON);
SystemSettingsSchema.set('toObject', mongooseTransform.toObject);
