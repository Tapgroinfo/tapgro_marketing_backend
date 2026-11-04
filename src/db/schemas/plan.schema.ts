import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

@Schema({ _id: false })
export class PlanLimit {
  /** Code-facing key, e.g. max_social_accounts. */
  @Prop({ required: true, lowercase: true, trim: true })
  key: string;

  @Prop({ type: String, default: '' })
  label: string;

  /** -1 means unlimited. */
  @Prop({ type: Number, required: true })
  value: number;
}
export const PlanLimitSchema = SchemaFactory.createForClass(PlanLimit);

export type PlanDocument = HydratedDocument<Plan>;

@Schema({ timestamps: true })
export class Plan {
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

  /** Amounts in major currency units (e.g. rupees). */
  @Prop({ type: Number, required: true, min: 0 })
  priceMonthly: number;

  @Prop({ type: Number, default: null, min: 0 })
  priceYearly: number | null;

  @Prop({ type: String, default: 'INR' })
  currency: string;

  @Prop({ type: Number, default: 0, min: 0 })
  trialDays: number;

  /** Marketing bullet points. */
  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ type: [PlanLimitSchema], default: [] })
  limits: PlanLimit[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /** Shown on the public pricing page. */
  @Prop({ type: Boolean, default: true })
  isPublic: boolean;

  /** Highlighted ("Most popular"). */
  @Prop({ type: Boolean, default: false })
  isPopular: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);

PlanSchema.set('toJSON', mongooseTransform.toJSON);
PlanSchema.set('toObject', mongooseTransform.toObject);
