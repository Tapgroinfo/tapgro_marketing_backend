import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

export const NOTIFICATION_TYPES = [
  'info',
  'success',
  'warning',
  'error',
] as const;
export const NOTIFICATION_RETENTION_DAYS = 180;

export type AdminNotificationDocument = HydratedDocument<AdminNotification>;

/** In-panel notification (bell icon), one row per recipient admin. */
@Schema({ timestamps: true })
export class AdminNotification {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  recipient: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, default: '' })
  message: string;

  @Prop({ type: String, enum: [...NOTIFICATION_TYPES], default: 'info' })
  type: string;

  /** Grouping for filters / icons, e.g. support, system, announcement. */
  @Prop({ type: String, default: 'system' })
  category: string;

  /** Panel route to open on click, e.g. /support/<id>. */
  @Prop({ type: String, default: '' })
  link: string;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  createdAt?: Date;
}

export const AdminNotificationSchema =
  SchemaFactory.createForClass(AdminNotification);

AdminNotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
AdminNotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 },
);

AdminNotificationSchema.set('toJSON', mongooseTransform.toJSON);
AdminNotificationSchema.set('toObject', mongooseTransform.toObject);
