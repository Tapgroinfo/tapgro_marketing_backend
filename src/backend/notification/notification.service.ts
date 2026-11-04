import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminNotification } from '../../db/schemas/adminNotification.schema';
import { User } from '../../db/schemas/user.schema';
import { GlobalService } from '../globalService/global.service';
import { Pagination } from '../../utils/pagination';
import { hasPermissions } from '../../utils/permission-check.util';

export type NotifyInput = {
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  link?: string;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(AdminNotification.name)
    private readonly notificationModel: Model<AdminNotification>,
    @InjectModel('User') private readonly userModel: Model<User>,
    private readonly globalService: GlobalService,
  ) {}

  /**
   * Notify every active admin, optionally only those holding `permission`
   * (e.g. 'read:support'). Never throws. Returns recipient count.
   */
  async notifyAdmins(input: NotifyInput, permission?: string) {
    try {
      const admins = await this.userModel
        .find({ isDeleted: false, status: { $ne: false } })
        .select('_id role permissions')
        .populate('role', 'role permissions')
        .lean();
      const recipients = permission
        ? admins.filter((a) => hasPermissions(a, [permission]))
        : admins;
      if (!recipients.length) return 0;

      await this.notificationModel.insertMany(
        recipients.map((a) => ({ ...input, recipient: a._id })),
      );
      return recipients.length;
    } catch (error) {
      this.logger.error(`Failed to create notifications: ${String(error)}`);
      return 0;
    }
  }

  /** Never throws. */
  async notifyUser(userId: string, input: NotifyInput) {
    try {
      await this.notificationModel.create({ ...input, recipient: userId });
    } catch (error) {
      this.logger.error(`Failed to create notification: ${String(error)}`);
    }
  }

  async findMine(
    userId: string,
    filter: Pagination & { isRead?: boolean; category?: string },
  ) {
    const query: Record<string, unknown> = { recipient: userId };
    if (filter.isRead !== undefined) query.isRead = filter.isRead;
    if (filter.category) query.category = filter.category;
    const result = await this.globalService.paginate<AdminNotification>({
      model: this.notificationModel,
      query,
      pagination: filter,
    });
    return { ...result, unreadCount: await this.unreadCount(userId) };
  }

  async unreadCount(userId: string) {
    return this.notificationModel.countDocuments({
      recipient: userId,
      isRead: false,
    });
  }

  async markRead(id: string, userId: string) {
    const result = await this.notificationModel.updateOne(
      { _id: id, recipient: userId },
      { isRead: true, readAt: new Date() },
    );
    if (!result.matchedCount) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true, message: 'Notification marked as read' };
  }

  async markAllRead(userId: string) {
    const result = await this.notificationModel.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return {
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read`,
    };
  }

  async remove(id: string, userId: string) {
    const result = await this.notificationModel.deleteOne({
      _id: id,
      recipient: userId,
    });
    if (!result.deletedCount) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true, message: 'Notification deleted' };
  }
}
