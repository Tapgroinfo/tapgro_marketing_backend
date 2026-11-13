import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
] as const;

export const LEAD_SOURCES = [
  'meta_lead_ad',
  'facebook',
  'instagram',
  'google_business',
  'whatsapp',
  'website',
  'walk_in',
  'manual',
  'other',
] as const;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class LeadNote {
  @Prop({ required: true })
  text: string;

  createdAt?: Date;
}
export const LeadNoteSchema = SchemaFactory.createForClass(LeadNote);

export type LeadDocument = HydratedDocument<Lead>;

/** A potential client of a customer — from Meta lead ads, social DMs, website or added by hand. */
@Schema({ timestamps: true })
export class Lead {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  })
  customer: Types.ObjectId;

  @Prop({
    type: String,
    enum: [...LEAD_SOURCES],
    default: 'manual',
    index: true,
  })
  source: string;

  /** Platform slug the lead came through (facebook, instagram, google_business…). */
  @Prop({ type: String, default: '', index: true })
  platform: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SocialChannel',
    default: null,
  })
  channel: Types.ObjectId | null;

  @Prop({ type: String, default: '', trim: true })
  name: string;

  @Prop({ type: String, default: '', trim: true, index: true })
  mobile: string;

  @Prop({ type: String, default: '', lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, default: '' })
  message: string;

  /** Raw form answers (Meta lead form question → answer). */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  fields: Record<string, unknown>;

  @Prop({ type: String, enum: [...LEAD_STATUSES], default: 'new', index: true })
  status: string;

  @Prop({ type: [LeadNoteSchema], default: [] })
  notes: LeadNote[];

  @Prop({ type: Date, default: null })
  followUpAt: Date | null;

  /** Meta leadgen id etc. — dedupe key for webhook leads. */
  @Prop({ type: String, default: undefined })
  providerLeadId?: string;

  @Prop({ type: String, default: '' })
  formId: string;

  @Prop({ type: String, default: '' })
  formName: string;

  @Prop({ type: String, default: '' })
  adId: string;

  @Prop({ type: String, default: '' })
  campaignId: string;

  @Prop({ type: Boolean, default: false })
  isOrganic: boolean;

  @Prop({ type: Date, default: () => new Date(), index: true })
  receivedAt: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

LeadSchema.index({ customer: 1, status: 1, receivedAt: -1 });
LeadSchema.index({ providerLeadId: 1 }, { unique: true, sparse: true });

LeadSchema.set('toJSON', mongooseTransform.toJSON);
LeadSchema.set('toObject', mongooseTransform.toObject);
