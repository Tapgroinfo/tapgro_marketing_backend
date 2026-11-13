import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

export const CUSTOMER_STATUSES = ['active', 'blocked'] as const;

/** Business owner using the customer app (salon, clinic, shop…). Logs in by mobile OTP. */
@Schema({ timestamps: true })
export class Customer {
  /** 10-digit Indian mobile, without country code. */
  @Prop({ required: true, unique: true, index: true, trim: true })
  mobile: string;

  @Prop({ type: String, default: '+91' })
  countryCode: string;

  @Prop({ type: String, default: '', trim: true })
  name: string;

  @Prop({ type: String, default: '', lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, default: '', trim: true })
  businessName: string;

  @Prop({ type: String, default: '', trim: true })
  businessCategory: string;

  @Prop({ type: String, default: '', trim: true })
  city: string;

  @Prop({ type: String, default: '' })
  avatarUrl: string;

  /** Existing TapGro (Hub) customer — set from the TapGro directory or by an admin. */
  @Prop({ type: Boolean, default: false, index: true })
  isTapgroUser: boolean;

  /** Id of the customer / salon in the TapGro Hub system. */
  @Prop({ type: String, default: '' })
  tapgroRef: string;

  /** directory = matched TapGro member list, admin = set manually. */
  @Prop({ type: String, enum: ['', 'directory', 'admin'], default: '' })
  tapgroSource: string;

  @Prop({ type: Date, default: null })
  tapgroLinkedAt: Date | null;

  @Prop({
    type: String,
    enum: [...CUSTOMER_STATUSES],
    default: 'active',
    index: true,
  })
  status: string;

  @Prop({ type: Date, default: null })
  lastLogin: Date | null;

  /** SHA-256 of the refresh token. */
  @Prop({ type: String, default: null, index: true })
  refreshTokenHash: string | null;

  @Prop({ type: Date, default: null })
  refreshTokenExpiresAt: Date | null;

  /** Embedded in JWTs; increment to revoke all sessions. */
  @Prop({ type: Number, default: 0 })
  tokenVersion: number;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

/** OTP state per mobile (exists before the customer is created). */
@Schema({ timestamps: true })
export class CustomerOtp {
  @Prop({ required: true, unique: true, index: true })
  mobile: string;

  @Prop({ type: String, default: null })
  otpHash: string | null;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: Date, default: null })
  lastSentAt: Date | null;

  /** Sends inside the current rolling hour window. */
  @Prop({ type: Number, default: 0 })
  sendCount: number;

  @Prop({ type: Date, default: null })
  windowStartedAt: Date | null;
}

/** Known TapGro Hub customers; a matching mobile is flagged isTapgroUser on login. */
@Schema({ timestamps: true })
export class TapgroMember {
  @Prop({ required: true, unique: true, index: true })
  mobile: string;

  @Prop({ type: String, default: '' })
  tapgroRef: string;

  @Prop({ type: String, default: '' })
  name: string;

  @Prop({ type: String, default: '' })
  businessName: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  addedBy: Types.ObjectId | null;
}

export type CustomerDocument = HydratedDocument<Customer>;
export type CustomerOtpDocument = HydratedDocument<CustomerOtp>;
export type TapgroMemberDocument = HydratedDocument<TapgroMember>;

export const CustomerSchema = SchemaFactory.createForClass(Customer);
export const CustomerOtpSchema = SchemaFactory.createForClass(CustomerOtp);
export const TapgroMemberSchema = SchemaFactory.createForClass(TapgroMember);

// OTP rows are useless after a day
CustomerOtpSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

for (const schema of [CustomerSchema, CustomerOtpSchema, TapgroMemberSchema]) {
  schema.set('toJSON', mongooseTransform.toJSON);
  schema.set('toObject', mongooseTransform.toObject);
}
