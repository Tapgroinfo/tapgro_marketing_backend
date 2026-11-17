import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

/**
 * A brand / salon whose channels we manage. Maps 1:1 to a Zernio profile
 * (Zernio externalId = this document's id).
 */
@Schema({ timestamps: true })
export class SocialProfile {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ type: String, default: '' })
  description: string;

  /** Accent color on Zernio (hex, e.g. #F8A5A5). */
  @Prop({ type: String, default: '' })
  color: string;

  /** IANA timezone for scheduling (e.g. Asia/Kolkata). Empty = Zernio UTC default. */
  @Prop({ type: String, default: '' })
  timezone: string;

  /** Optional id in another TapGro system (e.g. salon id). */
  @Prop({ type: String, default: '', index: true })
  externalRef: string;

  /** Set when the profile belongs to a customer-app user (one profile per customer). */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    default: undefined,
  })
  customer?: Types.ObjectId;

  @Prop({ type: String, default: 'zernio' })
  provider: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  providerProfileId: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastSyncedAt: Date | null;
}

export const CHANNEL_STATUSES = [
  'connected',
  'warning',
  'needs_reconnect',
  'disconnected',
] as const;

@Schema({ _id: false })
export class ChannelTestResult {
  @Prop({ type: String, enum: ['health', 'post'] })
  mode: string;

  @Prop({ type: Boolean })
  success: boolean;

  @Prop({ type: String, default: '' })
  message: string;

  @Prop({ type: String, default: '' })
  postId: string;

  @Prop({ type: String, default: '' })
  postUrl: string;

  @Prop({ type: Date })
  at: Date;
}
export const ChannelTestResultSchema =
  SchemaFactory.createForClass(ChannelTestResult);

/** One connected account: a Facebook Page, Instagram, GBP location, YouTube channel, Meta ad account… */
@Schema({ timestamps: true })
export class SocialChannel {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SocialProfile',
    required: true,
    index: true,
  })
  profile: Types.ObjectId;

  /** Our platform slug (facebook, instagram, google_business, meta_ads…). */
  @Prop({ required: true, index: true })
  platform: string;

  /** Provider's platform value (e.g. googlebusiness, metaads). */
  @Prop({ type: String, default: '' })
  providerPlatform: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  providerAccountId: string;

  @Prop({ type: String, default: '' })
  username: string;

  @Prop({ type: String, default: '' })
  displayName: string;

  @Prop({ type: String, default: '' })
  avatarUrl: string;

  @Prop({
    type: String,
    enum: [...CHANNEL_STATUSES],
    default: 'connected',
    index: true,
  })
  status: string;

  @Prop({ type: Boolean, default: true })
  canPost: boolean;

  @Prop({ type: Boolean, default: true })
  canFetchAnalytics: boolean;

  @Prop({ type: [String], default: [] })
  issues: string[];

  @Prop({ type: Date, default: null })
  lastHealthAt: Date | null;

  @Prop({ type: ChannelTestResultSchema, default: null })
  lastTest: ChannelTestResult | null;

  @Prop({ type: Date, default: null })
  connectedAt: Date | null;

  @Prop({ type: Date, default: null })
  disconnectedAt: Date | null;

  @Prop({ type: String, default: '' })
  disconnectReason: string;
}

export const CONNECT_SESSION_STATUSES = [
  'pending',
  'connected',
  'failed',
] as const;

/** One "Connect channel" attempt; `state` is round-tripped through OAuth. */
@Schema({ timestamps: true })
export class SocialConnectSession {
  @Prop({ required: true, unique: true, index: true })
  state: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SocialProfile',
    required: true,
  })
  profile: Types.ObjectId;

  @Prop({ required: true })
  platform: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  createdBy: Types.ObjectId | null;

  /** Started from the customer app (vs admin panel) — decides the return URL. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    default: null,
  })
  customer: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: [...CONNECT_SESSION_STATUSES],
    default: 'pending',
  })
  status: string;

  @Prop({ type: String, default: '' })
  message: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SocialChannel',
    default: null,
  })
  channel: Types.ObjectId | null;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export type SocialProfileDocument = HydratedDocument<SocialProfile>;
export type SocialChannelDocument = HydratedDocument<SocialChannel>;
export type SocialConnectSessionDocument =
  HydratedDocument<SocialConnectSession>;

export const SocialProfileSchema = SchemaFactory.createForClass(SocialProfile);
export const SocialChannelSchema = SchemaFactory.createForClass(SocialChannel);
export const SocialConnectSessionSchema =
  SchemaFactory.createForClass(SocialConnectSession);

SocialChannelSchema.index({ profile: 1, platform: 1 });
SocialProfileSchema.index({ customer: 1 }, { unique: true, sparse: true });
// Sessions are only useful for a day
SocialConnectSessionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 },
);

for (const schema of [
  SocialProfileSchema,
  SocialChannelSchema,
  SocialConnectSessionSchema,
]) {
  schema.set('toJSON', mongooseTransform.toJSON);
  schema.set('toObject', mongooseTransform.toObject);
}
