import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { mongooseTransform } from '../../utils/mongoose-transform';

@Schema({ _id: false })
export class ModulePermission {
  @Prop({
    type: String,
    required: true,
  })
  module: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_create: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_view: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_edit: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_delete: boolean;
}

export const ModulePermissionSchema =
  SchemaFactory.createForClass(ModulePermission);

@Schema({ timestamps: true })
export class Role {
  @Prop({
    type: String,
  })
  role: string;

  @Prop({
    type: [ModulePermissionSchema],
    default: [],
  })
  permissions: ModulePermission[];

  @Prop({
    type: Boolean,
    default: false,
  })
  isDefault: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  isDeleted: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.set('toJSON', mongooseTransform.toJSON);
RoleSchema.set('toObject', mongooseTransform.toObject);
