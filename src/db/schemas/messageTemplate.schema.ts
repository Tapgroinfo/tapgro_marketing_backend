import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

export const TEMPLATE_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number];

export type MessageTemplateDocument = HydratedDocument<MessageTemplate>;

/** Editable email / SMS / WhatsApp content with {{variable}} placeholders. */
@Schema({ timestamps: true })
export class MessageTemplate {
  @Prop({ type: String, enum: [...TEMPLATE_CHANNELS], required: true })
  channel: string;

  /** Code-facing key, e.g. admin_password_reset_otp. Unique per channel. */
  @Prop({ required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  name: string;

  /** Email only. */
  @Prop({ type: String, default: '' })
  subject: string;

  /** Email: HTML. SMS: exact DLT-approved text. WhatsApp: preview text. */
  @Prop({ type: String, required: true })
  body: string;

  /** Documented placeholders (without braces). */
  @Prop({ type: [String], default: [] })
  variables: string[];

  /** SMS: DLT content id. WhatsApp: provider template code. */
  @Prop({ type: String, default: '' })
  providerTemplateId: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /** Used by code — slug/channel locked and cannot be deleted. */
  @Prop({ type: Boolean, default: false })
  isSystem: boolean;
}

export const MessageTemplateSchema =
  SchemaFactory.createForClass(MessageTemplate);

MessageTemplateSchema.index({ channel: 1, slug: 1 }, { unique: true });

MessageTemplateSchema.set('toJSON', mongooseTransform.toJSON);
MessageTemplateSchema.set('toObject', mongooseTransform.toObject);
