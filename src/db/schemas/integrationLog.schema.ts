import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

export const INTEGRATION_LOG_TYPES = [
  'webhook',
  'email',
  'sms',
  'whatsapp',
  'api',
] as const;
export const INTEGRATION_LOG_STATUSES = [
  'received',
  'success',
  'failed',
  'skipped',
] as const;
export const INTEGRATION_LOG_RETENTION_DAYS = 90;

export type IntegrationLogDocument = HydratedDocument<IntegrationLog>;

/** Outbound sends (email/SMS/WhatsApp/API) and inbound webhooks. */
@Schema({ timestamps: true })
export class IntegrationLog {
  @Prop({ type: String, enum: [...INTEGRATION_LOG_TYPES], required: true })
  type: string;

  /** zernio | ayrshare | smtp | sms_gateway | whatsapp_gateway … */
  @Prop({ type: String, required: true })
  provider: string;

  @Prop({ type: String, enum: ['inbound', 'outbound'], required: true })
  direction: string;

  @Prop({ type: String, default: '' })
  event: string;

  @Prop({ type: String, enum: [...INTEGRATION_LOG_STATUSES], required: true })
  status: string;

  /** Recipient (email / phone) or URL. */
  @Prop({ type: String, default: '' })
  target: string;

  @Prop({ type: Number, default: null })
  statusCode: number | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  request: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  response: unknown;

  @Prop({ type: String, default: '' })
  error: string;

  /** Inbound webhooks only; null when no secret is configured. */
  @Prop({ type: Boolean, default: null })
  signatureValid: boolean | null;

  @Prop({ type: Number, default: null })
  durationMs: number | null;

  createdAt?: Date;
}

export const IntegrationLogSchema =
  SchemaFactory.createForClass(IntegrationLog);

IntegrationLogSchema.index({ type: 1, createdAt: -1 });
IntegrationLogSchema.index({ status: 1, createdAt: -1 });
IntegrationLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: INTEGRATION_LOG_RETENTION_DAYS * 24 * 60 * 60 },
);

IntegrationLogSchema.set('toJSON', mongooseTransform.toJSON);
IntegrationLogSchema.set('toObject', mongooseTransform.toObject);
