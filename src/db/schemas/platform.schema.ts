import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';
import { PLATFORM_CAPABILITIES } from '../../utils/platform.constants';

export type PlatformDocument = HydratedDocument<Platform>;

/** Social platform a salon can connect (Facebook, Instagram, Google Business…). */
@Schema({ timestamps: true })
export class Platform {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  slug: string;

  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: String, default: '' })
  iconUrl: string;

  @Prop({ type: [String], enum: [...PLATFORM_CAPABILITIES], default: [] })
  capabilities: string[];

  /** Whether salons can connect this platform. */
  @Prop({ type: Boolean, default: false, index: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const PlatformSchema = SchemaFactory.createForClass(Platform);

PlatformSchema.set('toJSON', mongooseTransform.toJSON);
PlatformSchema.set('toObject', mongooseTransform.toObject);
