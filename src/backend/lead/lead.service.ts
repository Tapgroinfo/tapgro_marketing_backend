import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead } from '../../db/schemas/lead.schema';
import { SocialChannel, SocialProfile } from '../../db/schemas/social.schema';
import { GlobalService } from '../globalService/global.service';
import { Pagination } from '../../utils/pagination';
import { AddLeadNoteDto, CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';

export type LeadFilter = Pagination & {
  customerId?: string;
  status?: string;
  source?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
};

const NAME_KEYS = ['full_name', 'name', 'fullname'];
const PHONE_KEYS = [
  'phone_number',
  'phone',
  'mobile',
  'mobile_number',
  'whatsapp_number',
];
const EMAIL_KEYS = ['email', 'email_address', 'work_email'];

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<Lead>,
    @InjectModel(SocialProfile.name)
    private readonly profileModel: Model<SocialProfile>,
    @InjectModel(SocialChannel.name)
    private readonly channelModel: Model<SocialChannel>,
    private readonly globalService: GlobalService,
  ) {}

  // ---------- queries (customer-scoped when customerId is set) ----------

  async findAll(filter: LeadFilter) {
    return this.globalService.paginate<Lead>({
      model: this.leadModel,
      query: this.buildQuery(filter),
      pagination: { ...filter, sort_attr: filter.sort_attr || 'receivedAt' },
      select: '-fields',
      populate: filter.customerId ? undefined : 'customer',
    });
  }

  buildQuery(filter: LeadFilter) {
    const query: Record<string, any> = {};
    if (filter.customerId) query.customer = this.toId(filter.customerId);
    for (const key of ['status', 'source', 'platform'] as const) {
      if (filter[key]) query[key] = filter[key];
    }
    if (filter.search) {
      query.$or = ['name', 'mobile', 'email'].map((field) => ({
        [field]: { $regex: filter.search, $options: 'i' },
      }));
    }
    if (filter.startDate || filter.endDate) {
      query.receivedAt = {};
      if (filter.startDate) query.receivedAt.$gte = new Date(filter.startDate);
      if (filter.endDate) query.receivedAt.$lte = new Date(filter.endDate);
    }
    return query;
  }

  async findOne(id: string, customerId?: string) {
    const query: Record<string, unknown> = { _id: this.toId(id) };
    if (customerId) query.customer = this.toId(customerId);
    const lead = await this.leadModel
      .findOne(query)
      .populate('channel', 'platform username displayName')
      .populate(
        customerId
          ? []
          : [
              {
                path: 'customer',
                select: 'name mobile businessName isTapgroUser',
              },
            ],
      );
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async summary(customerId?: string) {
    const match: Record<string, unknown> = {};
    if (customerId) match.customer = this.toId(customerId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [byStatus, bySource, last30Days, total] = await Promise.all([
      this.group(match, '$status'),
      this.group(match, '$source'),
      this.leadModel.countDocuments({ ...match, receivedAt: { $gte: since } }),
      this.leadModel.countDocuments(match),
    ]);
    return { total, last30Days, byStatus, bySource };
  }

  // ---------- writes (customer app) ----------

  async create(customerId: string, dto: CreateLeadDto) {
    const lead = await this.leadModel.create({
      ...dto,
      customer: customerId,
      source: dto.source || 'manual',
      receivedAt: new Date(),
    });
    return { success: true, message: 'Lead added', data: lead };
  }

  async update(customerId: string, id: string, dto: UpdateLeadDto) {
    const lead = await this.findOne(id, customerId);
    lead.set(dto);
    await lead.save();
    return { success: true, message: 'Lead updated', data: lead };
  }

  async addNote(customerId: string, id: string, dto: AddLeadNoteDto) {
    const lead = await this.findOne(id, customerId);
    lead.notes.push({ text: dto.text });
    if (lead.status === 'new') lead.status = 'contacted';
    await lead.save();
    return { success: true, message: 'Note added', data: lead };
  }

  async remove(customerId: string, id: string) {
    const lead = await this.findOne(id, customerId);
    await lead.deleteOne();
    return { success: true, message: 'Lead deleted' };
  }

  // ---------- webhook ----------

  /** Zernio `lead.received` (Meta Lead Gen form). Never throws. */
  async createFromZernio(payload: Record<string, any>) {
    try {
      const lead = payload?.lead || {};
      const account = payload?.account || {};
      if (!lead.leadgenId) return { handled: false, reason: 'No leadgenId' };

      const profile = account.profileId
        ? await this.profileModel.findOne({
            providerProfileId: account.profileId,
          })
        : null;
      if (!profile?.customer) {
        return {
          handled: false,
          reason: 'Profile is not linked to a customer',
        };
      }
      if (await this.leadModel.exists({ providerLeadId: lead.leadgenId })) {
        return { handled: true, duplicate: true };
      }

      const fields: Record<string, unknown> = lead.fields || {};
      const channel = await this.channelModel.findOne({
        providerAccountId: account.accountId || account.id,
      });
      const first = this.pick(fields, ['first_name']);
      const last = this.pick(fields, ['last_name']);

      const created = await this.leadModel.create({
        customer: profile.customer,
        source: 'meta_lead_ad',
        platform: channel?.platform || 'facebook',
        channel: channel?._id ?? null,
        name:
          this.pick(fields, NAME_KEYS) ||
          [first, last].filter(Boolean).join(' '),
        mobile: this.pick(fields, PHONE_KEYS),
        email: this.pick(fields, EMAIL_KEYS),
        fields: {
          ...fields,
          ...(lead.consents ? { _consents: lead.consents } : {}),
        },
        providerLeadId: lead.leadgenId,
        formId: lead.formId || '',
        formName: lead.formName || '',
        adId: lead.adId || '',
        campaignId: lead.campaignId || '',
        isOrganic: !!lead.isOrganic,
        receivedAt: lead.createdAt ? new Date(lead.createdAt) : new Date(),
      });
      return { handled: true, leadId: created.id };
    } catch (error) {
      this.logger.error(`Lead webhook failed: ${String(error)}`);
      return { handled: false, reason: 'Error saving lead' };
    }
  }

  // ---------- helpers ----------

  private pick(fields: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = fields[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  private async group(match: Record<string, unknown>, field: string) {
    const rows = await this.leadModel.aggregate<{ _id: string; count: number }>(
      [{ $match: match }, { $group: { _id: field, count: { $sum: 1 } } }],
    );
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  private toId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Not found');
    }
    return new Types.ObjectId(id);
  }
}
