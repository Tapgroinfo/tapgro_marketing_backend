import { UserSchema } from './schemas/user.schema';
import { RoleSchema } from './schemas/role.schema';
import { PermissionSchema } from './schemas/permission.schema';
import { PlatformSchema } from './schemas/platform.schema';
import { SystemSettingsSchema } from './schemas/setting.schema';
import {
  MessageTemplate,
  MessageTemplateSchema,
} from './schemas/messageTemplate.schema';

/** Models the seeder needs at the app root. */
export const schemas = [
  { name: 'User', schema: UserSchema },
  { name: 'Role', schema: RoleSchema },
  { name: 'Permission', schema: PermissionSchema },
  { name: 'Platform', schema: PlatformSchema },
  { name: 'SystemSettings', schema: SystemSettingsSchema },
  { name: MessageTemplate.name, schema: MessageTemplateSchema },
];
