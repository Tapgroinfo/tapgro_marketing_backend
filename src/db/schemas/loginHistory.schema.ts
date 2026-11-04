import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

export const LOGIN_RESULTS = [
  'success',
  'invalid_password',
  'unknown_user',
  'locked',
  'disabled',
] as const;
export const LOGIN_HISTORY_RETENTION_DAYS = 180;

export type LoginHistoryDocument = HydratedDocument<LoginHistory>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class LoginHistory {
  /** Null when the email did not match an admin. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  user: Types.ObjectId | null;

  @Prop({ type: String, lowercase: true, trim: true })
  email: string;

  @Prop({ type: Boolean, required: true })
  success: boolean;

  @Prop({ type: String, enum: [...LOGIN_RESULTS], required: true })
  result: string;

  @Prop({ type: String, default: '' })
  ip: string;

  @Prop({ type: String, default: '' })
  userAgent: string;

  createdAt?: Date;
}

export const LoginHistorySchema = SchemaFactory.createForClass(LoginHistory);

LoginHistorySchema.index({ user: 1, createdAt: -1 });
LoginHistorySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: LOGIN_HISTORY_RETENTION_DAYS * 24 * 60 * 60 },
);

LoginHistorySchema.set('toJSON', mongooseTransform.toJSON);
LoginHistorySchema.set('toObject', mongooseTransform.toObject);
