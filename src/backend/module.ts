import { AdminModule } from './admin/admin.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { PlatformModule } from './platform/platform.module';
import { SettingsModule } from './settings/settings.module';
import { AuditTrailModule } from './auditTrail/auditTrail.module';
import { IntegrationLogModule } from './integrationLog/integrationLog.module';
import { TemplateModule } from './template/template.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationModule } from './notification/notification.module';
import { UploadModule } from './upload/upload.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CmsModule } from './cms/cms.module';
import { PlanModule } from './plan/plan.module';
import { SupportModule } from './support/support.module';
import { ExportModule } from './export/export.module';

/** Admin panel `/api/backend/v1` + public `/api/public/v1` APIs */
const BackendModules = [
  AdminModule,
  RoleModule,
  PermissionModule,
  DashboardModule,
  PlatformModule,
  PlanModule,
  SupportModule,
  CmsModule,
  TemplateModule,
  MessagingModule,
  NotificationModule,
  UploadModule,
  ExportModule,
  SettingsModule,
  IntegrationLogModule,
  AuditTrailModule,
];

export { BackendModules };
