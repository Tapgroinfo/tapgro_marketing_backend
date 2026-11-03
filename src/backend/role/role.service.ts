import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../../db/schemas/role.schema';
import { User } from '../../db/schemas/user.schema';
import { Permission } from '../../db/schemas/permission.schema';
import { CreateRoleDto } from './dto/createRole.dto';
import { UpdateRoleDto } from './dto/updateRole.dto';
import { Pagination } from '../../utils/pagination';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { auditActionDes } from '../../utils/auditActionDesEnum';
import { PaginationResult } from '../../utils/interfaces/pagination.interface';

@Injectable()
export class RoleService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    private readonly globalService: GlobalService,
  ) {}

  async createRoleFun(dto: CreateRoleDto, user_id: string) {
    const exists = await this.roleModel.findOne({
      role: dto.role,
      isDeleted: false,
    });
    if (exists) {
      throw new BadRequestException('Role already exists');
    }
    const role = await this.roleModel.create({
      role: dto.role,
      permissions: dto.permissions,
    });

    await this.createAudit(
      user_id,
      auditAction.CREATE,
      auditActionDes.ROLE_CREATE,
      role,
    );

    return {
      success: true,
      message: 'Role created successfully',
      data: role,
    };
  }

  async updateRoleFun(dto: UpdateRoleDto, user_id: string, id: string) {
    const role = await this.roleModel.findOne({ _id: id, isDeleted: false });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    const exists = await this.roleModel.findOne({
      _id: { $ne: id },
      role: dto.role,
      isDeleted: false,
    });
    if (exists) {
      throw new BadRequestException('Role already exists');
    }

    const changes: string[] = [];
    if (role.role !== dto.role) {
      changes.push(`Role name changed from ${role.role} to ${dto.role}`);
    }

    role.role = dto.role;
    role.permissions = dto.permissions;
    await role.save();

    await this.createAudit(
      user_id,
      auditAction.UPDATE,
      changes.join(', ') || auditActionDes.ROLE_UPDATED,
      role,
    );

    return {
      success: true,
      message: 'Role updated successfully',
      data: role,
    };
  }

  async findAllRoleWithPaginationFun(
    pagination: Pagination,
  ): Promise<PaginationResult<Role>> {
    const query: Record<string, unknown> = { isDeleted: false };
    if (pagination.search) {
      query.role = { $regex: pagination.search, $options: 'i' };
    }

    return this.globalService.paginate<Role>({
      model: this.roleModel,
      query,
      pagination,
      select: { role: 1, permissions: 1, isDefault: 1, createdAt: 1 },
    });
  }

  async findAllRoleFun() {
    return await this.roleModel
      .find({ isDeleted: false })
      .select('role isDefault')
      .sort({ role: 1 })
      .exec();
  }

  async roleFindByIdFun(id: string) {
    const role = await this.roleModel
      .findOne({ _id: id, isDeleted: false })
      .exec();
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const allModules = await this.permissionModel
      .find({ isDeleted: false })
      .exec();

    const rolePermissions = role.permissions || [];
    role.permissions = allModules.map((m) => {
      const saved = rolePermissions.find(
        (rp) => rp?.module.toLowerCase() === m.slug.toLowerCase(),
      );
      return {
        module: m.slug.toLowerCase(),
        is_create: !!saved?.is_create,
        is_view: !!saved?.is_view,
        is_edit: !!saved?.is_edit,
        is_delete: !!saved?.is_delete,
      };
    });
    return role;
  }

  async deleteRoleFun(id: string, user_id: string) {
    const role = await this.roleModel.findOne({ _id: id, isDeleted: false });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isDefault) {
      throw new BadRequestException('The default role cannot be deleted');
    }

    const assigned = await this.userModel.exists({
      role: role._id,
      isDeleted: false,
    });
    if (assigned) {
      throw new BadRequestException('Users are assigned to this role');
    }

    role.isDeleted = true;
    await role.save();

    await this.createAudit(
      user_id,
      auditAction.DELETE,
      auditActionDes.ROLE_DELETE,
      role,
    );

    return {
      success: true,
      message: 'Role deleted successfully',
    };
  }

  /** Empty permission matrix (all false) for the "create role" form. */
  async getAvailablePermissions() {
    const permissions = await this.permissionModel
      .find({ isDeleted: false })
      .sort({ slug: 1 })
      .exec();

    const data = permissions.map((p) => ({
      module: p.slug.toLowerCase(),
      name: p.name,
      is_create: false,
      is_view: false,
      is_edit: false,
      is_delete: false,
    }));

    return {
      success: true,
      data,
    };
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
        auditType: auditType.ROLES_LOG,
      },
      data,
    );
  }
}
