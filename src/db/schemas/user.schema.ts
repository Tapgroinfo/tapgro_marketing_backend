import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Role, ModulePermission, ModulePermissionSchema } from './role.schema';
import { mongooseTransform } from '../../utils/mongoose-transform';

export type UserDocument = HydratedDocument<User>;

/** Admin panel user. */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, default: null, sparse: true, index: true })
  phone: string | null;

  @Prop({ type: String, default: 'EN' })
  language: string;

  @Prop({ type: String, default: null })
  image: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Role', required: true })
  role: Types.ObjectId | Role;

  /** Per-user overrides, OR-merged with role permissions. */
  @Prop({ type: [ModulePermissionSchema], default: [] })
  permissions: ModulePermission[];

  @Prop({ type: Date, default: Date.now })
  lastLogin: Date;

  /** SHA-256 hash of the issued refresh token. */
  @Prop({ type: String, default: null, index: true })
  refresh_token: string | null;

  @Prop({ type: Date, default: null })
  refresh_token_expires_at: Date | null;

  @Prop({ type: Boolean, default: true })
  status: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', mongooseTransform.toJSON);
UserSchema.set('toObject', mongooseTransform.toObject);
