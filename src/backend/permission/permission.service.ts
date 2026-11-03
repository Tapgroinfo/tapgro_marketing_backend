import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Permission } from '../../db/schemas/permission.schema';
import { CreatePermissionDto } from './dto/createPermission.dto';
import { UpdatePermissionDto } from './dto/updatePermission.dto';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditType } from '../../utils/auditTypeEnum';

@Injectable()
export class PermissionService {
  constructor(
    @InjectModel('Permission')
    private readonly permissionModel: Model<Permission>,
    private readonly globalService: GlobalService,
  ) {}

  async createPermissionFun(dto: CreatePermissionDto, user_id: string) {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.permissionModel.findOne({ slug });
    if (existing && !existing.isDeleted) {
      throw new BadRequestException('Permission slug already exists');
    }

    // Slug is unique across soft-deleted rows too, so revive instead of insert.
    const permission =
      existing ?? new this.permissionModel({ slug, name: dto.name });
    permission.name = dto.name;
    permission.isDeleted = false;
    await permission.save();

    await this.createAudit(
      user_id,
      auditAction.CREATE,
      `Permission module created: ${permission.slug}`,
      permission,
    );

    return {
      success: true,
      message: 'Permission module created successfully',
      data: permission,
    };
  }

  async updatePermissionFun(
    id: string,
    dto: UpdatePermissionDto,
    user_id: string,
  ) {
    const permission = await this.permissionModel.findById(id);
    if (!permission || permission.isDeleted) {
      throw new NotFoundException('Permission module not found');
    }
    if (dto.slug) {
      const slug = dto.slug.toLowerCase().trim();
      const exists = await this.permissionModel.findOne({
        _id: { $ne: id },
        slug,
      });
      if (exists) {
        throw new BadRequestException('Permission slug already exists');
      }
      permission.slug = slug;
    }
    if (dto.name) permission.name = dto.name;
    await permission.save();

    await this.createAudit(
      user_id,
      auditAction.UPDATE,
      `Permission module updated: ${permission.slug}`,
      permission,
    );

    return {
      success: true,
      message: 'Permission module updated successfully',
      data: permission,
    };
  }

  async deletePermissionFun(id: string, user_id: string) {
    const permission = await this.permissionModel.findById(id);
    if (!permission || permission.isDeleted) {
      throw new NotFoundException('Permission module not found');
    }

    permission.isDeleted = true;
    await permission.save();

    await this.createAudit(
      user_id,
      auditAction.DELETE,
      `Permission module deleted: ${permission.slug}`,
      permission,
    );

    return {
      success: true,
      message: 'Permission module deleted successfully',
    };
  }

  async findAllPermissionsFun() {
    return this.permissionModel
      .find({ isDeleted: false })
      .sort({ slug: 1 })
      .exec();
  }

  async permissionFindByIdFun(id: string) {
    const permission = await this.permissionModel.findById(id).exec();
    if (!permission || permission.isDeleted) {
      throw new NotFoundException('Permission module not found');
    }
    return permission;
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
        auditType: auditType.PERMISSION_LOG,
      },
      data,
    );
  }
}
