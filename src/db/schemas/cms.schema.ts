import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

@Schema({ timestamps: true })
export class Faq {
  @Prop({ required: true, trim: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: String, default: 'general', lowercase: true, trim: true })
  category: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

@Schema({ timestamps: true })
export class Banner {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, default: '' })
  subtitle: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ type: String, default: '' })
  linkUrl: string;

  /** Where the client shows it, e.g. home, login, dashboard. */
  @Prop({ type: String, default: 'home', lowercase: true, trim: true })
  position: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  startAt: Date | null;

  @Prop({ type: Date, default: null })
  endAt: Date | null;
}

@Schema({ timestamps: true })
export class CmsPage {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  slug: string;

  @Prop({ type: String, default: '' })
  contentHtml: string;

  @Prop({ type: String, default: '' })
  metaTitle: string;

  @Prop({ type: String, default: '' })
  metaDescription: string;

  @Prop({ type: Boolean, default: false })
  isPublished: boolean;
}

export type FaqDocument = HydratedDocument<Faq>;
export type BannerDocument = HydratedDocument<Banner>;
export type CmsPageDocument = HydratedDocument<CmsPage>;

export const FaqSchema = SchemaFactory.createForClass(Faq);
export const BannerSchema = SchemaFactory.createForClass(Banner);
export const CmsPageSchema = SchemaFactory.createForClass(CmsPage);

FaqSchema.index({ category: 1, sortOrder: 1 });
BannerSchema.index({ position: 1, isActive: 1, sortOrder: 1 });

for (const schema of [FaqSchema, BannerSchema, CmsPageSchema]) {
  schema.set('toJSON', mongooseTransform.toJSON);
  schema.set('toObject', mongooseTransform.toObject);
}
