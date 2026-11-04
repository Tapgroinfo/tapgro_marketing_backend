import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../db/schemas/user.schema';
import { Role } from '../../db/schemas/role.schema';
import { Platform } from '../../db/schemas/platform.schema';
import { Plan } from '../../db/schemas/plan.schema';
import { SupportTicket } from '../../db/schemas/supportTicket.schema';
import { IntegrationLog } from '../../db/schemas/integrationLog.schema';
import { LoginHistory } from '../../db/schemas/loginHistory.schema';
import { AuditTrail } from '../../db/schemas/auditTrail.schema';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<User>,
    @InjectModel('Role') private readonly roleModel: Model<Role>,
    @InjectModel(Platform.name) private readonly platformModel: Model<Platform>,
    @InjectModel(Plan.name) private readonly planModel: Model<Plan>,
    @InjectModel(SupportTicket.name)
    private readonly ticketModel: Model<SupportTicket>,
    @InjectModel(IntegrationLog.name)
    private readonly integrationLogModel: Model<IntegrationLog>,
    @InjectModel(LoginHistory.name)
    private readonly loginHistoryModel: Model<LoginHistory>,
    @InjectModel('AuditTrail') private readonly auditModel: Model<AuditTrail>,
  ) {}

  async summary() {
    const since = new Date(Date.now() - DAY_MS);
    const notDeleted = { isDeleted: false };

    const [
      adminsTotal,
      adminsActive,
      adminsLocked,
      roles,
      platformsTotal,
      platformsActive,
      plansTotal,
      plansActive,
      ticketsByStatus,
      unassignedOpen,
      integrations,
      logins,
      recentActivity,
    ] = await Promise.all([
      this.userModel.countDocuments(notDeleted),
      this.userModel.countDocuments({ ...notDeleted, status: true }),
      this.userModel.countDocuments({
        ...notDeleted,
        lockedUntil: { $gt: new Date() },
      }),
      this.roleModel.countDocuments(notDeleted),
      this.platformModel.countDocuments(notDeleted),
      this.platformModel.countDocuments({ ...notDeleted, isActive: true }),
      this.planModel.countDocuments(notDeleted),
      this.planModel.countDocuments({ ...notDeleted, isActive: true }),
      this.groupCount(this.ticketModel, 'status'),
      this.ticketModel.countDocuments({
        status: { $in: ['open', 'in_progress'] },
        assignedTo: null,
      }),
      this.groupCount(this.integrationLogModel, 'status', {
        createdAt: { $gte: since },
      }),
      this.groupCount(this.loginHistoryModel, 'success', {
        createdAt: { $gte: since },
      }),
      this.auditModel
        .find()
        .sort({ updatedTime: -1 })
        .limit(10)
        .select('-additionalDetail')
        .populate('updatedBy', 'name email'),
    ]);

    return {
      success: true,
      data: {
        admins: {
          total: adminsTotal,
          active: adminsActive,
          disabled: adminsTotal - adminsActive,
          locked: adminsLocked,
        },
        roles,
        platforms: { total: platformsTotal, active: platformsActive },
        plans: { total: plansTotal, active: plansActive },
        support: {
          open: ticketsByStatus.open || 0,
          inProgress: ticketsByStatus.in_progress || 0,
          resolved: ticketsByStatus.resolved || 0,
          closed: ticketsByStatus.closed || 0,
          unassignedOpen,
        },
        last24h: {
          integrations: {
            success: integrations.success || 0,
            failed: integrations.failed || 0,
            skipped: integrations.skipped || 0,
            webhooksReceived: integrations.received || 0,
          },
          logins: {
            success: logins.true || 0,
            failed: logins.false || 0,
          },
        },
        recentActivity,
      },
    };
  }

  private async groupCount(
    model: Model<any>,
    field: string,
    match: Record<string, unknown> = {},
  ): Promise<Record<string, number>> {
    const rows = await model.aggregate<{ _id: unknown; count: number }>([
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
  }
}
