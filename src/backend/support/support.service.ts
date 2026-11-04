import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupportTicket } from '../../db/schemas/supportTicket.schema';
import { Counter } from '../../db/schemas/counter.schema';
import { User } from '../../db/schemas/user.schema';
import { GlobalService } from '../globalService/global.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationService } from '../notification/notification.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination } from '../../utils/pagination';
import { TEMPLATE_SLUGS } from '../../utils/template.constants';
import {
  CreateTicketDto,
  ReplyTicketDto,
  UpdateTicketDto,
} from './dto/support.dto';

export type TicketFilter = Pagination & {
  status?: string;
  priority?: string;
  assignedTo?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
};

type AdminRef = { id: string; name?: string };

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name)
    private readonly ticketModel: Model<SupportTicket>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    @InjectModel('User') private readonly userModel: Model<User>,
    private readonly globalService: GlobalService,
    private readonly messagingService: MessagingService,
    private readonly notificationService: NotificationService,
  ) {}

  async createPublic(dto: CreateTicketDto, ip: string) {
    const response = {
      success: true,
      message: 'Thanks! Your request has been received.',
    };
    // Honeypot filled → bot. Pretend success, store nothing.
    if (dto.website) return response;

    const data: Partial<CreateTicketDto> = { ...dto };
    delete data.website;
    const ticket = await this.ticketModel.create({
      ...data,
      ticketNo: await this.nextTicketNo(),
      ip,
    });

    await this.notificationService.notifyAdmins(
      {
        title: `New support request ${ticket.ticketNo}`,
        message: ticket.subject,
        category: 'support',
        link: `/support/${ticket._id.toString()}`,
      },
      'read:support',
    );
    await this.messagingService.sendTemplate({
      channel: 'email',
      slug: TEMPLATE_SLUGS.SUPPORT_TICKET_RECEIVED,
      to: ticket.email,
      variables: {
        name: ticket.name,
        ticketNo: ticket.ticketNo,
        subject: ticket.subject,
      },
    });

    return { ...response, data: { ticketNo: ticket.ticketNo } };
  }

  async findAll(filter: TicketFilter) {
    return this.globalService.paginate<SupportTicket>({
      model: this.ticketModel,
      query: this.buildQuery(filter),
      pagination: filter,
      select: '-replies -ip',
      populate: 'assignedTo',
    });
  }

  buildQuery(filter: TicketFilter) {
    const query: Record<string, any> = {};
    for (const key of ['status', 'priority', 'category'] as const) {
      if (filter[key]) query[key] = filter[key];
    }
    if (filter.assignedTo) {
      query.assignedTo =
        filter.assignedTo === 'none' ? null : filter.assignedTo;
    }
    if (filter.search) {
      query.$or = ['ticketNo', 'subject', 'email', 'name'].map((field) => ({
        [field]: { $regex: filter.search, $options: 'i' },
      }));
    }
    if (filter.startDate || filter.endDate) {
      query.createdAt = {};
      if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
    }
    return query;
  }

  async findOne(id: string) {
    const ticket = await this.ticketModel
      .findById(id)
      .populate('assignedTo', 'name email')
      .populate('replies.by', 'name email');
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, admin: AdminRef) {
    const ticket = await this.findRaw(id);
    const previousAssignee = ticket.assignedTo?.toString() || null;

    if (dto.assignedTo) {
      const assignee = await this.userModel.exists({
        _id: dto.assignedTo,
        isDeleted: false,
        status: { $ne: false },
      });
      if (!assignee) {
        throw new NotFoundException('Assigned admin not found');
      }
    }

    if (dto.status && dto.status !== ticket.status) {
      ticket.resolvedAt = ['resolved', 'closed'].includes(dto.status)
        ? new Date()
        : null;
    }
    ticket.set(dto);
    await ticket.save();

    const newAssignee = ticket.assignedTo?.toString() || null;
    if (
      newAssignee &&
      newAssignee !== previousAssignee &&
      newAssignee !== admin.id
    ) {
      await this.notificationService.notifyUser(newAssignee, {
        title: `Ticket ${ticket.ticketNo} assigned to you`,
        message: ticket.subject,
        category: 'support',
        link: `/support/${ticket._id.toString()}`,
      });
    }

    await this.audit(admin.id, auditAction.UPDATE, ticket, dto);
    return {
      success: true,
      message: 'Ticket updated successfully',
      data: await this.findOne(id),
    };
  }

  async reply(id: string, dto: ReplyTicketDto, admin: AdminRef) {
    const ticket = await this.findRaw(id);
    const isInternal = !!dto.isInternal;

    let emailed = false;
    if (!isInternal) {
      const result = await this.messagingService.sendTemplate({
        channel: 'email',
        slug: TEMPLATE_SLUGS.SUPPORT_TICKET_REPLY,
        to: ticket.email,
        variables: {
          name: ticket.name,
          ticketNo: ticket.ticketNo,
          subject: ticket.subject,
          message: dto.message,
        },
      });
      emailed = result.sent;
    }

    ticket.replies.push({
      message: dto.message,
      by: admin.id as any,
      byName: admin.name || '',
      isInternal,
      emailed,
    });
    ticket.lastReplyAt = new Date();
    if (!isInternal && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    await ticket.save();

    await this.audit(admin.id, auditAction.UPDATE, ticket, {
      reply: isInternal ? 'internal note' : 'reply',
    });
    return {
      success: true,
      message: isInternal
        ? 'Internal note added'
        : emailed
          ? 'Reply sent to customer'
          : 'Reply saved, but the email could not be sent (check SMTP settings / integration logs)',
      data: await this.findOne(id),
    };
  }

  async remove(id: string, admin: AdminRef) {
    const ticket = await this.findRaw(id);
    await ticket.deleteOne();
    await this.audit(admin.id, auditAction.DELETE, ticket, {});
    return { success: true, message: 'Ticket deleted successfully' };
  }

  async countByStatus() {
    const rows = await this.ticketModel.aggregate<{
      _id: string;
      count: number;
    }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  private async findRaw(id: string) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private async nextTicketNo() {
    const counter = await this.counterModel.findOneAndUpdate(
      { _id: 'support_ticket' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return `TKT-${String(counter.seq).padStart(6, '0')}`;
  }

  private async audit(
    user_id: string,
    action: string,
    ticket: SupportTicket,
    detail: unknown,
  ) {
    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action,
        description: `${action} Ticket ${ticket.ticketNo}`,
        auditType: auditType.SUPPORT_LOG,
      },
      detail,
    );
  }
}
