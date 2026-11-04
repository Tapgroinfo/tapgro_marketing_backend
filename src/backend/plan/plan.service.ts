import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan } from '../../db/schemas/plan.schema';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination, Sort } from '../../utils/pagination';
import { CreatePlanDto, PlanLimitDto, UpdatePlanDto } from './dto/plan.dto';

const PUBLIC_FIELDS =
  'name slug description priceMonthly priceYearly currency trialDays features limits isPopular sortOrder';

@Injectable()
export class PlanService {
  constructor(
    @InjectModel(Plan.name) private readonly planModel: Model<Plan>,
    private readonly globalService: GlobalService,
  ) {}

  async create(dto: CreatePlanDto, user_id: string) {
    this.assertUniqueLimitKeys(dto.limits);
    const existing = await this.planModel.findOne({ slug: dto.slug });
    if (existing && !existing.isDeleted) {
      throw new BadRequestException('Plan slug already exists');
    }

    // Slug is unique across soft-deleted plans too, so revive instead of insert.
    const plan = existing ?? new this.planModel();
    plan.set({
      description: '',
      priceYearly: null,
      currency: 'INR',
      trialDays: 0,
      features: [],
      limits: [],
      isActive: true,
      isPublic: true,
      isPopular: false,
      sortOrder: 0,
      ...dto,
      isDeleted: false,
    });
    await plan.save();

    await this.audit(user_id, auditAction.CREATE, plan);
    return { success: true, message: 'Plan created successfully', data: plan };
  }

  async update(id: string, dto: UpdatePlanDto, user_id: string) {
    this.assertUniqueLimitKeys(dto.limits);
    const plan = await this.findOne(id);
    if (dto.slug && dto.slug !== plan.slug) {
      if (await this.planModel.exists({ _id: { $ne: id }, slug: dto.slug })) {
        throw new BadRequestException('Plan slug already exists');
      }
    }
    plan.set(dto);
    await plan.save();

    await this.audit(user_id, auditAction.UPDATE, plan);
    return { success: true, message: 'Plan updated successfully', data: plan };
  }

  async remove(id: string, user_id: string) {
    const plan = await this.findOne(id);
    plan.isDeleted = true;
    plan.isActive = false;
    await plan.save();

    await this.audit(user_id, auditAction.DELETE, plan);
    return { success: true, message: 'Plan deleted successfully' };
  }

  async findOne(id: string) {
    const plan = await this.planModel.findOne({ _id: id, isDeleted: false });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  async findAll(filter: Pagination & { isActive?: boolean }) {
    const query: Record<string, unknown> = { isDeleted: false };
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { slug: { $regex: filter.search, $options: 'i' } },
      ];
    }
    return this.globalService.paginate<Plan>({
      model: this.planModel,
      query,
      pagination: {
        ...filter,
        sort_attr: filter.sort_attr || 'sortOrder',
        sort: filter.sort || Sort.ASC,
      },
    });
  }

  async findPublic() {
    return this.planModel
      .find({ isDeleted: false, isActive: true, isPublic: true })
      .select(PUBLIC_FIELDS)
      .sort({ sortOrder: 1, priceMonthly: 1 });
  }

  private assertUniqueLimitKeys(limits?: PlanLimitDto[]) {
    if (!limits) return;
    const keys = limits.map((l) => l.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Limit keys must be unique');
    }
  }

  private async audit(user_id: string, action: string, plan: Plan) {
    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action,
        description: `${action} Plan: ${plan.slug}`,
        auditType: auditType.PLAN_LOG,
      },
      plan,
    );
  }
}
