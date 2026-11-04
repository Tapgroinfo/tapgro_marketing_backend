import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const TICKET_SOURCES = ['website', 'app', 'email', 'other'] as const;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class TicketReply {
  @Prop({ required: true })
  message: string;

  /** Admin who replied; null for requester messages. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  by: Types.ObjectId | null;

  @Prop({ type: String, default: '' })
  byName: string;

  /** Internal notes are never emailed to the requester. */
  @Prop({ type: Boolean, default: false })
  isInternal: boolean;

  @Prop({ type: Boolean, default: false })
  emailed: boolean;

  createdAt?: Date;
}
export const TicketReplySchema = SchemaFactory.createForClass(TicketReply);

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

@Schema({ timestamps: true })
export class SupportTicket {
  /** Human friendly, e.g. TKT-000042. */
  @Prop({ required: true, unique: true, index: true })
  ticketNo: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: String, default: 'general', lowercase: true, trim: true })
  category: string;

  @Prop({ type: String, enum: [...TICKET_SOURCES], default: 'website' })
  source: string;

  @Prop({
    type: String,
    enum: [...TICKET_STATUSES],
    default: 'open',
    index: true,
  })
  status: string;

  @Prop({ type: String, enum: [...TICKET_PRIORITIES], default: 'medium' })
  priority: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  assignedTo: Types.ObjectId | null;

  @Prop({ type: [TicketReplySchema], default: [] })
  replies: TicketReply[];

  @Prop({ type: Date, default: null })
  lastReplyAt: Date | null;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;

  @Prop({ type: String, default: '' })
  ip: string;

  createdAt?: Date;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);

SupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

SupportTicketSchema.set('toJSON', mongooseTransform.toJSON);
SupportTicketSchema.set('toObject', mongooseTransform.toObject);
