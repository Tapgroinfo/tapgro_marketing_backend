import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Customer,
  CustomerDocument,
  TapgroMember,
} from '../../db/schemas/customer.schema';
import { Lead } from '../../db/schemas/lead.schema';
import { SocialChannel, SocialProfile } from '../../db/schemas/social.schema';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination } from '../../utils/pagination';
import { tryNormalizeIndianMobile } from '../../utils/mobile.util';
import {
  AdminUpdateCustomerDto,
  ImportTapgroMembersDto,
  UpdateCustomerTapgroDto,
} from './dto/customer-admin.dto';

export const CUSTOMER_PRIVATE_FIELDS =
  '-refreshTokenHash -refreshTokenExpiresAt -tokenVersion';

@Injectable()
export class CustomerService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(TapgroMember.name)
    private readonly memberModel: Model<TapgroMember>,
    @InjectModel(Lead.name) private readonly leadModel: Model<Lead>,
    @InjectModel(SocialProfile.name)
    private readonly profileModel: Model<SocialProfile>,
    @InjectModel(SocialChannel.name)
    private readonly channelModel: Model<SocialChannel>,
    private readonly globalService: GlobalService,
  ) {}

  // ---------- admin ----------

  async findAll(
    filter: Pagination & { status?: string; isTapgroUser?: boolean },
  ) {
    const query: Record<string, unknown> = { isDeleted: false };
    if (filter.status) query.status = filter.status;
    if (filter.isTapgroUser !== undefined)
      query.isTapgroUser = filter.isTapgroUser;
    if (filter.search) {
      query.$or = ['name', 'mobile', 'businessName', 'email', 'tapgroRef'].map(
        (field) => ({ [field]: { $regex: filter.search, $options: 'i' } }),
      );
    }
    return this.globalService.paginate<Customer>({
      model: this.customerModel,
      query,
      pagination: filter,
      select: CUSTOMER_PRIVATE_FIELDS,
    });
  }

  async findOne(id: string) {
    const customer = await this.findOrFail(id);
    const profile = await this.profileModel.findOne({ customer: customer._id });
    const [channels, leads] = await Promise.all([
      profile
        ? this.channelModel
            .find({ profile: profile._id })
            .select('platform username displayName status canPost lastHealthAt')
        : [],
      this.leadModel.aggregate<{ _id: string; count: number }>([
        { $match: { customer: customer._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    return {
      ...this.toSafe(customer),
      socialProfileId: profile?.id ?? null,
      channels,
      leadsByStatus: Object.fromEntries(leads.map((l) => [l._id, l.count])),
    };
  }

  async update(id: string, dto: AdminUpdateCustomerDto, adminId: string) {
    const customer = await this.findOrFail(id);
    customer.set(dto);
    await customer.save();
    await this.audit(
      adminId,
      auditAction.UPDATE,
      `Customer updated: ${customer.mobile}`,
      dto,
    );
    return {
      success: true,
      message: 'Customer updated',
      data: this.toSafe(customer),
    };
  }

  async setStatus(id: string, status: string, adminId: string) {
    const customer = await this.findOrFail(id);
    customer.status = status;
    if (status === 'blocked') {
      customer.tokenVersion = (customer.tokenVersion || 0) + 1;
      customer.refreshTokenHash = null;
      customer.refreshTokenExpiresAt = null;
    }
    await customer.save();
    await this.audit(
      adminId,
      auditAction.UPDATE,
      `Customer ${status}: ${customer.mobile}`,
      { status },
    );
    return {
      success: true,
      message:
        status === 'blocked'
          ? 'Customer blocked and logged out'
          : 'Customer activated',
      data: this.toSafe(customer),
    };
  }

  async setTapgro(id: string, dto: UpdateCustomerTapgroDto, adminId: string) {
    const customer = await this.findOrFail(id);
    customer.isTapgroUser = dto.isTapgroUser;
    customer.tapgroRef = dto.isTapgroUser
      ? (dto.tapgroRef ?? customer.tapgroRef)
      : '';
    customer.tapgroSource = dto.isTapgroUser ? 'admin' : '';
    customer.tapgroLinkedAt = dto.isTapgroUser ? new Date() : null;
    await customer.save();
    await this.audit(
      adminId,
      auditAction.UPDATE,
      `Customer ${dto.isTapgroUser ? 'marked' : 'unmarked'} as TapGro user: ${customer.mobile}`,
      dto,
    );
    return {
      success: true,
      message: 'TapGro flag updated',
      data: this.toSafe(customer),
    };
  }

  // ---------- TapGro member directory ----------

  async findMembers(filter: Pagination) {
    const query: Record<string, unknown> = {};
    if (filter.search) {
      query.$or = ['mobile', 'tapgroRef', 'name', 'businessName'].map(
        (field) => ({
          [field]: { $regex: filter.search, $options: 'i' },
        }),
      );
    }
    return this.globalService.paginate<TapgroMember>({
      model: this.memberModel,
      query,
      pagination: filter,
    });
  }

  /** Upserts members and flags matching existing customers right away. */
  async importMembers(dto: ImportTapgroMembersDto, adminId: string) {
    const invalid: string[] = [];
    const byMobile = new Map<string, (typeof dto.members)[number]>();
    for (const member of dto.members) {
      const mobile = tryNormalizeIndianMobile(member.mobile);
      if (!mobile) invalid.push(member.mobile);
      else byMobile.set(mobile, member);
    }

    if (byMobile.size) {
      await this.memberModel.bulkWrite(
        [...byMobile].map(([mobile, m]) => ({
          updateOne: {
            filter: { mobile },
            update: {
              $set: {
                tapgroRef: m.tapgroRef || '',
                name: m.name || '',
                businessName: m.businessName || '',
              },
              $setOnInsert: { mobile, addedBy: new Types.ObjectId(adminId) },
            },
            upsert: true,
          },
        })),
      );
    }

    const customers = await this.customerModel.find({
      mobile: { $in: [...byMobile.keys()] },
      isTapgroUser: false,
      isDeleted: false,
    });
    for (const customer of customers) {
      this.applyMember(
        customer,
        byMobile.get(customer.mobile)!.tapgroRef || '',
      );
      await customer.save();
    }

    await this.audit(adminId, auditAction.CREATE, 'TapGro members imported', {
      imported: byMobile.size,
      invalid: invalid.length,
      customersFlagged: customers.length,
    });
    return {
      success: true,
      message: `${byMobile.size} member(s) saved, ${customers.length} existing customer(s) flagged`,
      data: {
        saved: byMobile.size,
        customersFlagged: customers.length,
        invalid,
      },
    };
  }

  async removeMember(id: string, adminId: string) {
    const member = Types.ObjectId.isValid(id)
      ? await this.memberModel.findById(id)
      : null;
    if (!member) throw new NotFoundException('Member not found');
    await member.deleteOne();
    await this.audit(
      adminId,
      auditAction.DELETE,
      `TapGro member removed: ${member.mobile}`,
      {},
    );
    return {
      success: true,
      message: 'Member removed (customers already flagged keep their flag)',
    };
  }

  /** Called on customer login / signup. Saves nothing; caller saves. */
  async applyDirectory(customer: CustomerDocument) {
    if (customer.isTapgroUser) return false;
    const member = await this.memberModel.findOne({ mobile: customer.mobile });
    if (!member) return false;
    this.applyMember(customer, member.tapgroRef);
    if (!customer.name && member.name) customer.name = member.name;
    if (!customer.businessName && member.businessName) {
      customer.businessName = member.businessName;
    }
    return true;
  }

  toSafe(customer: CustomerDocument) {
    const plain = customer.toObject() as unknown as Record<string, unknown>;
    delete plain.refreshTokenHash;
    delete plain.refreshTokenExpiresAt;
    delete plain.tokenVersion;
    return plain;
  }

  private applyMember(customer: CustomerDocument, tapgroRef: string) {
    customer.isTapgroUser = true;
    customer.tapgroRef = tapgroRef;
    customer.tapgroSource = 'directory';
    customer.tapgroLinkedAt = new Date();
  }

  private async findOrFail(id: string) {
    const customer = Types.ObjectId.isValid(id)
      ? await this.customerModel.findOne({ _id: id, isDeleted: false })
      : null;
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  private async audit(
    adminId: string,
    action: string,
    description: string,
    data: unknown,
  ) {
    await this.globalService.createAuditTrail(
      {
        updatedBy: adminId,
        action,
        description,
        auditType: auditType.CUSTOMER_LOG,
      },
      data,
    );
  }
}
