import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

export type PermissionDocument = HydratedDocument<Permission>;

/** Permission module catalog; roles grant create/view/edit/delete per slug. */
@Schema({ timestamps: true })
export class Permission {
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

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

PermissionSchema.set('toJSON', mongooseTransform.toJSON);
PermissionSchema.set('toObject', mongooseTransform.toObject);
