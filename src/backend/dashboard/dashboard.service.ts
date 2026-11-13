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
import { SocialChannel } from '../../db/schemas/social.schema';
import { Customer } from '../../db/schemas/customer.schema';
import { Lead } from '../../db/schemas/lead.schema';

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
    @InjectModel(SocialChannel.name)
    private readonly channelModel: Model<SocialChannel>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(Lead.name) private readonly leadModel: Model<Lead>,
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
      channels,
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
      this.groupCount(this.channelModel, 'status'),
    ]);

    const [
      customersTotal,
      tapgroCustomers,
      customersNew24h,
      leadsByStatus,
      leads24h,
    ] = await Promise.all([
      this.customerModel.countDocuments(notDeleted),
      this.customerModel.countDocuments({ ...notDeleted, isTapgroUser: true }),
      this.customerModel.countDocuments({
        ...notDeleted,
        createdAt: { $gte: since },
      }),
      this.groupCount(this.leadModel, 'status'),
      this.leadModel.countDocuments({ receivedAt: { $gte: since } }),
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
        customers: {
          total: customersTotal,
          tapgroUsers: tapgroCustomers,
          newLast24h: customersNew24h,
        },
        leads: {
          byStatus: leadsByStatus,
          last24h: leads24h,
        },
        channels: {
          connected: (channels.connected || 0) + (channels.warning || 0),
          needsReconnect: channels.needs_reconnect || 0,
          disconnected: channels.disconnected || 0,
        },
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
