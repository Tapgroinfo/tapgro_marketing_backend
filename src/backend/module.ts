import { AdminModule } from './admin/admin.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { PlatformModule } from './platform/platform.module';
import { SettingsModule } from './settings/settings.module';
import { AuditTrailModule } from './auditTrail/auditTrail.module';

/** Admin panel APIs — `/api/backend/v1` */
const BackendModules = [
  AdminModule,
  RoleModule,
  PermissionModule,
  PlatformModule,
  SettingsModule,
  AuditTrailModule,
];

export { BackendModules };
