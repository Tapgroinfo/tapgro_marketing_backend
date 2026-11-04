import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../../db/schemas/user.schema';
import { Role } from '../../db/schemas/role.schema';
import { Permission } from '../../db/schemas/permission.schema';
import { GlobalService } from '../globalService/global.service';
import { MessagingService } from '../messaging/messaging.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditActionDes } from '../../utils/auditActionDesEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination } from '../../utils/pagination';
import { TEMPLATE_SLUGS } from '../../utils/template.constants';
import { AuthService } from './auth.service';
import { SAFE_ADMIN_SELECT, SENSITIVE_ADMIN_FIELDS } from './admin.constants';
import { AdminCreateDto } from './dto/AdminCreateDto';
import { UpdateAdminProfileDto } from './dto/UpdateAdminProfileDto';
import { UpdateAdminPasswordDto } from './dto/UpdateAdminPasswordDto';
import { UpdateAdminDto } from './dto/UpdateAdminDto';
import { UpdateAdminPermissionsDto } from './dto/UpdateAdminPermissionsDto';

type RolePermissionRow = {
  module: string;
  is_create?: boolean;
  is_view?: boolean;
  is_edit?: boolean;
  is_delete?: boolean;
};

type PopulatedRole = {
  _id?: string;
  role?: string;
  permissions?: RolePermissionRow[];
} | null;

@Injectable()
export class AdminService {
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('Role') private roleModel: Model<Role>,
    @InjectModel('Permission') private permissionModel: Model<Permission>,
    private globalService: GlobalService,
    private messagingService: MessagingService,
    private authService: AuthService,
  ) {}

  async adminCreateServiceFun(dto: AdminCreateDto, current_user_id: string) {
    const email = dto.email.toLowerCase().trim();
    if (await this.userModel.exists({ email })) {
      throw new ConflictException('User already exists');
    }
    const role = await this.roleModel.findOne({
      _id: dto.role,
      isDeleted: false,
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const admin = await this.userModel.create({
      ...dto,
      email,
      role: role._id,
      password: await this.authService.hashPassword(dto.password),
      status: true,
      isDeleted: false,
    });

    await this.createAudit(
      current_user_id,
      auditAction.CREATE,
      auditActionDes.ADMIN_CREATED,
      admin,
    );
    await this.messagingService.sendTemplate({
      channel: 'email',
      slug: TEMPLATE_SLUGS.ADMIN_WELCOME,
      to: admin.email,
      variables: { name: admin.name, email: admin.email },
    });

    return {
      success: true,
      message: 'Admin created successfully',
      data: this.toSafeAdmin(admin),
    };
  }

  async getAdminProfileFun(id: string) {
    const user = await this.userModel
      .findOne({ _id: id, isDeleted: false })
      .select('name email phone image language status role lastLogin')
      .populate({ path: 'role', select: 'role permissions' })
      .exec();
    if (!user) {
      return null;
    }
    const allModules = await this.permissionModel
      .find({ isDeleted: false }, { slug: 1, _id: 0 })
      .exec();

    const roleData = user.role as PopulatedRole;
    const savedPermissions = roleData?.permissions || [];
    const permissions = allModules.map((moduleObj) => {
      const saved = savedPermissions.find(
        (sp) => sp?.module === moduleObj.slug,
      );
      return {
        module: moduleObj.slug,
        is_create: saved?.is_create ?? false,
        is_view: saved?.is_view ?? false,
        is_edit: saved?.is_edit ?? false,
        is_delete: saved?.is_delete ?? false,
      };
    });

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      language: user.language,
      status: user.status,
      lastLogin: user.lastLogin,
      role: roleData ? { id: roleData._id, name: roleData.role } : null,
      permissions,
    };
  }

  async updateAdminProfileFun(dto: UpdateAdminProfileDto, id: string) {
    const admin = await this.findAdminOrFail(id);
    const email = dto.email.toLowerCase().trim();

    if (email !== admin.email) {
      await this.assertEmailFree(email, id);
    }

    const changes: string[] = [];
    if (dto.name !== admin.name) {
      changes.push(`Name changed from ${admin.name} to ${dto.name}`);
    }
    if (email !== admin.email) {
      changes.push(`Email changed from ${admin.email} to ${email}`);
    }
    if (dto.phone !== admin.phone) {
      changes.push(`Phone changed from ${admin.phone} to ${dto.phone}`);
    }

    admin.name = dto.name;
    admin.email = email;
    admin.phone = dto.phone;
    if (dto.image !== undefined) admin.image = dto.image;
    await admin.save();

    await this.createAudit(
      id,
      auditAction.UPDATE,
      changes.length > 0 ? changes.join(', ') : 'Profile updated',
      admin,
    );

    return {
      success: true,
      message: 'Admin profile updated successfully',
      data: this.toSafeAdmin(admin),
    };
  }

  /** Changes own password, ends other sessions, returns fresh tokens. */
  async updateAdminPasswordFun(dto: UpdateAdminPasswordDto, id: string) {
    const admin = await this.findAdminOrFail(id);
    if (!(await bcrypt.compare(dto.oldPassword, admin.password))) {
      throw new BadRequestException('Incorrect password');
    }
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    admin.password = await this.authService.hashPassword(dto.newPassword);
    await this.authService.clearSession(admin, true);
    await this.createAudit(
      id,
      auditAction.UPDATE,
      'Admin password changed',
      admin,
    );

    return {
      success: true,
      message: 'Password updated. Other sessions have been logged out.',
      ...(await this.authService.issueTokens(admin)),
    };
  }

  async setAdminPasswordFun(
    id: string,
    newPassword: string,
    current_user_id: string,
  ) {
    if (id === current_user_id) {
      throw new BadRequestException(
        'Use change password to update your own password',
      );
    }
    const admin = await this.findAdminOrFail(id);
    admin.password = await this.authService.hashPassword(newPassword);
    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;
    await this.authService.clearSession(admin, true);

    await this.createAudit(
      current_user_id,
      auditAction.UPDATE,
      `Password reset by administrator for user ID ${id}`,
      admin,
    );
    return {
      success: true,
      message: 'Password updated and all sessions of this admin logged out',
    };
  }

  async updateAdminStatusFun(
    id: string,
    status: boolean,
    current_user_id: string,
  ) {
    if (id === current_user_id && !status) {
      throw new BadRequestException('You cannot disable your own account');
    }
    const admin = await this.findAdminOrFail(id);
    admin.status = status;
    if (status) {
      admin.failedLoginAttempts = 0;
      admin.lockedUntil = null;
      await admin.save();
    } else {
      await this.authService.clearSession(admin, true);
    }

    await this.createAudit(
      current_user_id,
      auditAction.UPDATE,
      `Admin ${status ? 'enabled' : 'disabled'}: user ID ${id}`,
      admin,
    );
    return {
      success: true,
      message: `Admin ${status ? 'enabled' : 'disabled'} successfully`,
      data: this.toSafeAdmin(admin),
    };
  }

  async deleteAdminFun(id: string, current_user_id: string) {
    if (id === current_user_id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const admin = await this.findAdminOrFail(id);
    admin.isDeleted = true;
    admin.status = false;
    await this.authService.clearSession(admin, true);

    await this.createAudit(
      current_user_id,
      auditAction.DELETE,
      auditActionDes.ADMIN_DELETED,
      admin,
    );
    return { success: true, message: 'Admin deleted successfully' };
  }

  async findAllAdminsWithPagination(
    pagination: Pagination & { status?: boolean; roleId?: string },
  ) {
    const query: Record<string, any> = { isDeleted: false };
    if (pagination.status !== undefined) query.status = pagination.status;
    if (pagination.roleId) query.role = pagination.roleId;
    if (pagination.search) {
      query.$or = [
        { name: { $regex: pagination.search, $options: 'i' } },
        { email: { $regex: pagination.search, $options: 'i' } },
        { phone: { $regex: pagination.search, $options: 'i' } },
      ];
    }

    const result = await this.globalService.paginate({
      model: this.userModel,
      query,
      pagination,
      select: SAFE_ADMIN_SELECT,
      populate: 'role',
    });
    return {
      success: true,
      totalCount: result.pagination.total,
      ...result,
    };
  }

  async updateAdminDetailsFun(
    id: string,
    dto: UpdateAdminDto,
    current_user_id: string,
  ) {
    const admin = await this.findAdminOrFail(id);

    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      if (email !== admin.email) {
        await this.assertEmailFree(email, id);
        admin.email = email;
      }
    }
    if (dto.role) {
      const role = await this.roleModel.findOne({
        _id: dto.role,
        isDeleted: false,
      });
      if (!role) {
        throw new NotFoundException('Assigned role not found');
      }
      admin.role = role._id;
    }
    if (dto.name !== undefined) admin.name = dto.name;
    if (dto.phone !== undefined) admin.phone = dto.phone;
    if (dto.permissions !== undefined) admin.permissions = dto.permissions;

    if (dto.status !== undefined && dto.status !== admin.status) {
      if (id === current_user_id && !dto.status) {
        throw new BadRequestException('You cannot disable your own account');
      }
      admin.status = dto.status;
      if (!dto.status) {
        admin.tokenVersion = (admin.tokenVersion || 0) + 1;
        admin.refresh_token = null;
        admin.refresh_token_expires_at = null;
      }
    }

    await admin.save();
    await this.createAudit(
      current_user_id,
      auditAction.UPDATE,
      `Updated Admin details for user ID ${id}`,
      admin,
    );
    return {
      success: true,
      message: 'Admin updated successfully',
      data: this.toSafeAdmin(admin),
    };
  }

  async updateAdminPermissionsFun(
    id: string,
    dto: UpdateAdminPermissionsDto,
    current_user_id: string,
  ) {
    const admin = await this.findAdminOrFail(id);
    admin.permissions = dto.permissions;
    await admin.save();

    await this.createAudit(
      current_user_id,
      auditAction.UPDATE,
      `Updated custom permission overrides for user ID ${id}`,
      admin,
    );
    return {
      success: true,
      message: 'User permissions updated successfully',
      data: this.toSafeAdmin(admin),
    };
  }

  async getAdminPermissionsMatrix(id: string) {
    const user = await this.userModel
      .findOne({ _id: id, isDeleted: false })
      .populate('role')
      .exec();
    if (!user) {
      throw new NotFoundException('Admin user not found');
    }

    const allModules = await this.permissionModel
      .find({ isDeleted: false })
      .exec();
    const roleObj = user.role as PopulatedRole;
    const rolePermissions = roleObj?.permissions || [];
    const userPermissions = user.permissions || [];

    const data = allModules.map((m) => {
      const key = m.slug.toLowerCase();
      const fromRole = rolePermissions.find(
        (rp) => rp?.module.toLowerCase() === key,
      );
      const fromUser = userPermissions.find(
        (up) => up?.module.toLowerCase() === key,
      );
      return {
        module: key,
        is_create: !!fromRole?.is_create || !!fromUser?.is_create,
        is_view: !!fromRole?.is_view || !!fromUser?.is_view,
        is_edit: !!fromRole?.is_edit || !!fromUser?.is_edit,
        is_delete: !!fromRole?.is_delete || !!fromUser?.is_delete,
      };
    });

    return { success: true, roleId: roleObj?._id || null, data };
  }

  /** Used by JwtStrategy — result becomes `request.user`. */
  async jwtFindOneById(id: string) {
    return this.userModel
      .findOne({ _id: id, isDeleted: false, status: { $ne: false } })
      .select('_id name email phone role permissions tokenVersion')
      .populate('role');
  }

  toSafeAdmin(admin: UserDocument) {
    const plain = admin.toObject() as unknown as Record<string, unknown>;
    for (const field of SENSITIVE_ADMIN_FIELDS) delete plain[field];
    return plain;
  }

  private async findAdminOrFail(id: string) {
    const admin = await this.userModel.findOne({ _id: id, isDeleted: false });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    return admin;
  }

  private async assertEmailFree(email: string, exceptId: string) {
    if (await this.userModel.exists({ email, _id: { $ne: exceptId } })) {
      throw new ConflictException('Email already in use by another user');
    }
  }

  private async createAudit(
    user_id: string,
    action: string,
    description: string,
    admin: UserDocument,
  ) {
    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action,
        description,
        auditType: auditType.ADMIN_LOG,
      },
      this.toSafeAdmin(admin),
    );
  }
}
