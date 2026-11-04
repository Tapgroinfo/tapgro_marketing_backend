import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../../db/schemas/user.schema';
import { Plan, PlanSchema } from '../../db/schemas/plan.schema';
import { Platform, PlatformSchema } from '../../db/schemas/platform.schema';
import {
  SupportTicket,
  SupportTicketSchema,
} from '../../db/schemas/supportTicket.schema';
import {
  IntegrationLog,
  IntegrationLogSchema,
} from '../../db/schemas/integrationLog.schema';
import {
  LoginHistory,
  LoginHistorySchema,
} from '../../db/schemas/loginHistory.schema';
import { AuditTrailSchema } from '../../db/schemas/auditTrail.schema';
import { RoleSchema } from '../../db/schemas/role.schema';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Role', schema: RoleSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Platform.name, schema: PlatformSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: IntegrationLog.name, schema: IntegrationLogSchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: 'AuditTrail', schema: AuditTrailSchema },
    ]),
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
