import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User, UserDocument } from '../../db/schemas/user.schema';
import { Role } from '../../db/schemas/role.schema';
import { Permission } from '../../db/schemas/permission.schema';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditActionDes } from '../../utils/auditActionDesEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination } from '../../utils/pagination';
import {
  parseDurationToMs,
  resolveAdminAccessExpiresIn,
  resolveAdminRefreshExpiresIn,
} from '../../utils/admin-jwt.constants';
import { AdminLoginDto } from './dto/AdminLogin.dto';
import { AdminCreateDto } from './dto/AdminCreateDto';
import { UpdateAdminProfileDto } from './dto/UpdateAdminProfileDto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { UpdateAdminPasswordDto } from './dto/UpdateAdminPasswordDto';
import { UpdateAdminDto } from './dto/UpdateAdminDto';
import { UpdateAdminPermissionsDto } from './dto/UpdateAdminPermissionsDto';

interface IUserJwt {
  id: string;
}

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

const SAFE_ADMIN_FIELDS = '-password -refresh_token -refresh_token_expires_at';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('Role') private roleModel: Model<Role>,
    @InjectModel('Permission') private permissionModel: Model<Permission>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private globalService: GlobalService,
  ) {}

  public async adminLoginServiceFun(adminLoginDto: AdminLoginDto) {
    const user = await this.findOneByEmail(adminLoginDto.email);
    if (!user || user.isDeleted) {
      throw new UnauthorizedException(
        'User not found. Please contact administrator.',
      );
    }
    if (user.status === false) {
      throw new UnauthorizedException('Your account is disabled.');
    }
    const isPasswordValid = await this.comparePassword(
      adminLoginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is invalid');
    }

    const lastLogin = new Date();
    await this.userModel.findByIdAndUpdate(user._id, { lastLogin });

    const userId = user._id.toString();
    const token = this.generateToken({ id: userId });
    const refreshTokenData = await this.issueRefreshToken(userId);
    const roleData = user.role as PopulatedRole;

    return {
      success: true,
      message: 'Admin logged in successfully',
      token,
      ...refreshTokenData,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        lastLogin,
        role: roleData ? { id: roleData._id, name: roleData.role } : null,
      },
    };
  }

  public async adminCreateServiceFun(
    adminCreateDto: AdminCreateDto,
    current_user_id: string,
  ) {
    const findUser = await this.findOneByEmail(adminCreateDto.email);
    if (findUser) {
      throw new ConflictException('User already exists');
    }
    const role = await this.roleModel.findOne({
      _id: adminCreateDto.role,
      isDeleted: false,
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const admin = await this.userModel.create({
      ...adminCreateDto,
      role: role._id,
      password: await this.hashPassword(adminCreateDto.password),
      status: true,
      isDeleted: false,
    });

    await this.createAudit(
      current_user_id,
      auditAction.CREATE,
      auditActionDes.ADMIN_CREATED,
      admin,
    );

    return {
      success: true,
      message: 'Admin created successfully',
      data: await this.userModel
        .findById(admin._id)
        .select(SAFE_ADMIN_FIELDS)
        .exec(),
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

  async updateAdminProfileFun(
    updateAdminProfileDto: UpdateAdminProfileDto,
    id: string,
  ) {
    const admin = await this.userModel.findById(id).exec();
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (updateAdminProfileDto.email !== admin.email) {
      const emailExists = await this.userModel.findOne({
        email: updateAdminProfileDto.email,
        _id: { $ne: id },
      });
      if (emailExists) {
        throw new ConflictException('Email already in use by another user');
      }
    }

    const changesArray: string[] = [];
    if (updateAdminProfileDto.name !== admin.name) {
      changesArray.push(
        `Name changed from ${admin.name} to ${updateAdminProfileDto.name}`,
      );
    }
    if (updateAdminProfileDto.email !== admin.email) {
      changesArray.push(
        `Email changed from ${admin.email} to ${updateAdminProfileDto.email}`,
      );
    }
    if (updateAdminProfileDto.phone !== admin.phone) {
      changesArray.push(
        `Phone changed from ${admin.phone} to ${updateAdminProfileDto.phone}`,
      );
    }

    admin.name = updateAdminProfileDto.name;
    admin.email = updateAdminProfileDto.email;
    admin.phone = updateAdminProfileDto.phone;
    await admin.save();

    await this.createAudit(
      id,
      auditAction.UPDATE,
      changesArray.length > 0 ? changesArray.join(', ') : 'Profile updated',
      admin,
    );

    return {
      success: true,
      message: 'Admin profile updated successfully',
      data: this.toSafeAdmin(admin),
    };
  }

  async updateAdminPasswordFun(
    updateAdminPasswordDto: UpdateAdminPasswordDto,
    id: string,
  ) {
    const admin = await this.userModel.findById(id).exec();
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    if (
      !(await this.comparePassword(
        updateAdminPasswordDto.oldPassword,
        admin.password,
      ))
    ) {
      throw new BadRequestException('Incorrect password');
    }
    if (
      updateAdminPasswordDto.newPassword !==
      updateAdminPasswordDto.confirmPassword
    ) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    admin.password = await this.hashPassword(
      updateAdminPasswordDto.newPassword,
    );
    admin.refresh_token = null;
    admin.refresh_token_expires_at = null;
    await admin.save();

    await this.createAudit(
      id,
      auditAction.UPDATE,
      'Admin password changed',
      admin,
    );

    return {
      success: true,
      message: 'Admin password updated successfully',
    };
  }

  async deleteAdminFun(id: string, current_user_id: string) {
    if (id === current_user_id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const admin = await this.userModel
      .findOne({ _id: id, isDeleted: false })
      .exec();
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    admin.isDeleted = true;
    admin.status = false;
    admin.refresh_token = null;
    admin.refresh_token_expires_at = null;
    await admin.save();

    await this.createAudit(
      current_user_id,
      auditAction.DELETE,
      auditActionDes.ADMIN_DELETED,
      admin,
    );

    return {
      success: true,
      message: 'Admin deleted successfully',
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const token = refreshTokenDto.refresh_token?.trim();
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const user = await this.userModel
      .findOne({
        refresh_token: this.hashToken(token),
        isDeleted: false,
        status: { $ne: false },
      })
      .exec();
    if (!user) {
      throw new UnauthorizedException(
        'Invalid refresh token. Please log in again.',
      );
    }

    const expiresAt = user.refresh_token_expires_at;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      await this.userModel.findByIdAndUpdate(user._id, {
        refresh_token: null,
        refresh_token_expires_at: null,
      });
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const accessToken = this.generateToken({ id: user._id.toString() });
    const accessExpiresIn = this.accessExpiresIn();

    return {
      success: true,
      message: 'Token refreshed successfully',
      token: accessToken,
      accessToken,
      refreshToken: token,
      expiresIn: accessExpiresIn,
      expiresInSeconds: Math.floor(parseDurationToMs(accessExpiresIn) / 1000),
    };
  }

  async adminLogout(adminId: string) {
    const user = await this.userModel.findOne({
      _id: adminId,
      isDeleted: false,
    });
    if (!user) {
      throw new NotFoundException('Admin not found');
    }

    await this.userModel.findByIdAndUpdate(adminId, {
      refresh_token: null,
      refresh_token_expires_at: null,
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async findAllAdminsWithPagination(pagination: Pagination) {
    const query: Record<string, any> = { isDeleted: false };
    if (pagination.search) {
      query['$or'] = [
        { name: { $regex: pagination.search, $options: 'i' } },
        { email: { $regex: pagination.search, $options: 'i' } },
        { phone: { $regex: pagination.search, $options: 'i' } },
      ];
    }

    const result = await this.globalService.paginate({
      model: this.userModel,
      query,
      pagination,
      select: SAFE_ADMIN_FIELDS,
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
    const admin = await this.userModel.findById(id);
    if (!admin || admin.isDeleted) {
      throw new NotFoundException('Admin user not found');
    }

    if (dto.email && dto.email !== admin.email) {
      const emailExists = await this.userModel.findOne({
        email: dto.email,
        _id: { $ne: id },
      });
      if (emailExists) {
        throw new ConflictException('Email already in use by another user');
      }
      admin.email = dto.email;
    }

    if (dto.role) {
      const roleExists = await this.roleModel.findOne({
        _id: dto.role,
        isDeleted: false,
      });
      if (!roleExists) {
        throw new NotFoundException('Assigned role not found');
      }
      admin.role = roleExists._id;
    }

    if (dto.name !== undefined) admin.name = dto.name;
    if (dto.phone !== undefined) admin.phone = dto.phone;
    if (dto.status !== undefined) admin.status = dto.status;
    if (dto.permissions !== undefined) admin.permissions = dto.permissions;

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
    const admin = await this.userModel.findById(id);
    if (!admin || admin.isDeleted) {
      throw new NotFoundException('Admin user not found');
    }

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
    const user = await this.userModel.findById(id).populate('role').exec();
    if (!user || user.isDeleted) {
      throw new NotFoundException('Admin user not found');
    }

    const allModules = await this.permissionModel
      .find({ isDeleted: false })
      .exec();

    const roleObj = user.role as PopulatedRole;
    const rolePermissions = roleObj?.permissions || [];
    const userDirectPermissions = user.permissions || [];

    const data = allModules.map((m) => {
      const mKey = m.slug.toLowerCase();
      const roleConfig = rolePermissions.find(
        (rp) => rp?.module.toLowerCase() === mKey,
      );
      const userConfig = userDirectPermissions.find(
        (up) => up?.module.toLowerCase() === mKey,
      );
      return {
        module: mKey,
        is_create: !!roleConfig?.is_create || !!userConfig?.is_create,
        is_view: !!roleConfig?.is_view || !!userConfig?.is_view,
        is_edit: !!roleConfig?.is_edit || !!userConfig?.is_edit,
        is_delete: !!roleConfig?.is_delete || !!userConfig?.is_delete,
      };
    });

    return {
      success: true,
      roleId: roleObj?._id || null,
      data,
    };
  }

  async findOneByEmail(email: string) {
    return this.userModel
      .findOne({ email: email?.toLowerCase().trim() })
      .populate({ path: 'role', select: 'role permissions' })
      .exec();
  }

  /** Used by JwtStrategy — result becomes `request.user`. */
  async jwtFindOneById(id: string) {
    return this.userModel
      .findOne({ _id: id, isDeleted: false, status: { $ne: false } })
      .select('_id name email phone role permissions')
      .populate('role');
  }

  async comparePassword(enteredPassword: string, dbPassword: string) {
    return await bcrypt.compare(enteredPassword, dbPassword);
  }

  private async issueRefreshToken(userId: string) {
    const refreshExpiresIn = resolveAdminRefreshExpiresIn(
      this.configService.get<string>('ADMIN_JWT_REFRESH_EXPIRES_IN'),
    );
    const refreshToken = randomBytes(48).toString('hex');

    await this.userModel.findByIdAndUpdate(userId, {
      refresh_token: this.hashToken(refreshToken),
      refresh_token_expires_at: new Date(
        Date.now() + parseDurationToMs(refreshExpiresIn),
      ),
    });

    const accessExpiresIn = this.accessExpiresIn();
    return {
      refreshToken,
      expiresIn: accessExpiresIn,
      expiresInSeconds: Math.floor(parseDurationToMs(accessExpiresIn) / 1000),
      refreshExpiresIn,
      refreshExpiresInSeconds: Math.floor(
        parseDurationToMs(refreshExpiresIn) / 1000,
      ),
    };
  }

  private accessExpiresIn() {
    return resolveAdminAccessExpiresIn(
      this.configService.get<string>('ADMIN_JWT_EXPIRES_IN'),
    );
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private toSafeAdmin(admin: UserDocument) {
    const plain = admin.toObject() as unknown as Record<string, unknown>;
    delete plain.password;
    delete plain.refresh_token;
    delete plain.refresh_token_expires_at;
    return plain;
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

  private generateToken(user: IUserJwt): string {
    return this.jwtService.sign(user);
  }

  protected async hashPassword(password: string) {
    const salt = await bcrypt.genSalt();
    return await bcrypt.hash(password, salt);
  }
}
