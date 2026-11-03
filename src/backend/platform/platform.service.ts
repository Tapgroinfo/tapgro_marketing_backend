import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Platform } from '../../db/schemas/platform.schema';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditActionDes } from '../../utils/auditActionDesEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { CreatePlatformDto } from './dto/createPlatform.dto';
import { UpdatePlatformDto } from './dto/updatePlatform.dto';

@Injectable()
export class PlatformService {
  constructor(
    @InjectModel(Platform.name)
    private readonly platformModel: Model<Platform>,
    private readonly globalService: GlobalService,
  ) {}

  async createPlatformFun(dto: CreatePlatformDto, user_id: string) {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.platformModel.findOne({ slug });
    if (existing && !existing.isDeleted) {
      throw new BadRequestException('Platform slug already exists');
    }

    // Slug is unique across soft-deleted rows too, so revive instead of insert.
    const platform = existing ?? new this.platformModel();
    platform.set({
      description: '',
      iconUrl: '',
      capabilities: [],
      isActive: false,
      sortOrder: 0,
      ...dto,
      slug,
      isDeleted: false,
    });
    await platform.save();

    await this.createAudit(
      user_id,
      auditAction.CREATE,
      auditActionDes.PLATFORM_CREATED,
      platform,
    );

    return {
      success: true,
      message: 'Platform created successfully',
      data: platform,
    };
  }

  async updatePlatformFun(id: string, dto: UpdatePlatformDto, user_id: string) {
    const platform = await this.findActiveOrFail(id);

    if (dto.slug) {
      const slug = dto.slug.toLowerCase().trim();
      const exists = await this.platformModel.findOne({
        _id: { $ne: id },
        slug,
      });
      if (exists) {
        throw new BadRequestException('Platform slug already exists');
      }
      dto.slug = slug;
    }

    platform.set(dto);
    await platform.save();

    await this.createAudit(
      user_id,
      auditAction.UPDATE,
      `Platform updated: ${platform.slug}`,
      platform,
    );

    return {
      success: true,
      message: 'Platform updated successfully',
      data: platform,
    };
  }

  async deletePlatformFun(id: string, user_id: string) {
    const platform = await this.findActiveOrFail(id);
    platform.isDeleted = true;
    platform.isActive = false;
    await platform.save();

    await this.createAudit(
      user_id,
      auditAction.DELETE,
      auditActionDes.PLATFORM_DELETED,
      platform,
    );

    return {
      success: true,
      message: 'Platform deleted successfully',
    };
  }

  async findAllPlatformsFun(filter: { search?: string; isActive?: boolean }) {
    const query: Record<string, unknown> = { isDeleted: false };
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { slug: { $regex: filter.search, $options: 'i' } },
      ];
    }
    return this.platformModel
      .find(query)
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async platformFindByIdFun(id: string) {
    return this.findActiveOrFail(id);
  }

  private async findActiveOrFail(id: string) {
    const platform = await this.platformModel.findOne({
      _id: id,
      isDeleted: false,
    });
    if (!platform) {
      throw new NotFoundException('Platform not found');
    }
    return platform;
  }

  private async createAudit(
    user_id: string,
    action: string,
    description: string,
    data: unknown,
  ) {
    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action,
        description,
        auditType: auditType.PLATFORM_LOG,
      },
      data,
    );
  }
}
