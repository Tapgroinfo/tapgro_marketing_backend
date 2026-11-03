import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { User } from './user.schema';
import { mongooseTransform } from '../../utils/mongoose-transform';

@Schema({ timestamps: true })
export class AuditTrail {
  @Prop({ type: String })
  auditType: string;

  @Prop({ type: String })
  action: string;

  @Prop({ type: String })
  additionalDetail: string;

  @Prop({ type: String })
  remarks: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  updatedBy: User;

  @Prop()
  updatedTime: Date;
}
export const AuditTrailSchema = SchemaFactory.createForClass(AuditTrail);

AuditTrailSchema.index({ auditType: 1, updatedTime: -1 });
AuditTrailSchema.index({ updatedBy: 1, updatedTime: -1 });
AuditTrailSchema.index({ updatedTime: -1 });

AuditTrailSchema.set('toJSON', mongooseTransform.toJSON);
AuditTrailSchema.set('toObject', mongooseTransform.toObject);
