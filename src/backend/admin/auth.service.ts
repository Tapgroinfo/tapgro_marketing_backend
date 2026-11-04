import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { User, UserDocument } from '../../db/schemas/user.schema';
import { LoginHistory } from '../../db/schemas/loginHistory.schema';
import { GlobalService } from '../globalService/global.service';
import { MessagingService } from '../messaging/messaging.service';
import { Pagination } from '../../utils/pagination';
import { TEMPLATE_SLUGS } from '../../utils/template.constants';
import {
  parseDurationToMs,
  resolveAdminAccessExpiresIn,
  resolveAdminRefreshExpiresIn,
} from '../../utils/admin-jwt.constants';
import { AdminLoginDto } from './dto/AdminLogin.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/PasswordReset.dto';
import {
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  RequestMeta,
  RESET_OTP_EXPIRY_MINUTES,
  RESET_OTP_MAX_ATTEMPTS,
  RESET_OTP_RESEND_SECONDS,
} from './admin.constants';

export type AdminJwtPayload = { id: string; v: number };

type PopulatedRole = { _id?: string; role?: string } | null;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel(LoginHistory.name)
    private loginHistoryModel: Model<LoginHistory>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private globalService: GlobalService,
    private messagingService: MessagingService,
  ) {}

  async login(dto: AdminLoginDto, meta: RequestMeta) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel
      .findOne({ email, isDeleted: false })
      .populate({ path: 'role', select: 'role' })
      .exec();

    if (!user) {
      await this.recordLogin(null, email, 'unknown_user', meta);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.recordLogin(user, email, 'locked', meta);
      const minutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Too many failed attempts. Try again in ${minutes} minute(s) or reset your password.`,
      );
    }
    if (user.status === false) {
      await this.recordLogin(user, email, 'disabled', meta);
      throw new ForbiddenException('Your account is disabled.');
    }

    if (!(await bcrypt.compare(dto.password, user.password))) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      user.failedLoginAttempts = attempts >= MAX_FAILED_LOGINS ? 0 : attempts;
      user.lockedUntil =
        attempts >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOCK_MINUTES * 60000)
          : null;
      await user.save();
      await this.recordLogin(user, email, 'invalid_password', meta);
      throw new UnauthorizedException('Invalid email or password');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    await user.save();
    await this.recordLogin(user, email, 'success', meta);

    const role = user.role as PopulatedRole;
    return {
      success: true,
      message: 'Admin logged in successfully',
      token: this.signAccessToken(user),
      ...(await this.issueRefreshToken(user)),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        lastLogin: user.lastLogin,
        role: role ? { id: role._id, name: role.role } : null,
      },
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    const token = dto.refresh_token?.trim();
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const user = await this.userModel.findOne({
      refresh_token: this.hash(token),
      isDeleted: false,
      status: { $ne: false },
    });
    if (!user) {
      throw new UnauthorizedException(
        'Invalid refresh token. Please log in again.',
      );
    }
    if (
      user.refresh_token_expires_at &&
      user.refresh_token_expires_at.getTime() <= Date.now()
    ) {
      await this.clearSession(user, false);
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const accessToken = this.signAccessToken(user);
    const expiresIn = this.accessExpiresIn();
    return {
      success: true,
      message: 'Token refreshed successfully',
      token: accessToken,
      accessToken,
      refreshToken: token,
      expiresIn,
      expiresInSeconds: Math.floor(parseDurationToMs(expiresIn) / 1000),
    };
  }

  async logout(adminId: string) {
    await this.userModel.findByIdAndUpdate(adminId, {
      refresh_token: null,
      refresh_token_expires_at: null,
    });
    return { success: true, message: 'Logged out successfully' };
  }

  /** Revokes every access + refresh token of this admin. */
  async logoutAllSessions(adminId: string) {
    const user = await this.userModel.findById(adminId);
    if (!user) {
      throw new NotFoundException('Admin not found');
    }
    await this.clearSession(user, true);
    return { success: true, message: 'All sessions have been logged out' };
  }

  /** Always succeeds so attackers can't probe which emails exist. */
  async forgotPassword(dto: ForgotPasswordDto) {
    const response = {
      success: true,
      message:
        'If an account exists for this email, a reset code has been sent.',
    };
    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase().trim(),
      isDeleted: false,
      status: { $ne: false },
    });
    if (!user) return response;

    if (
      user.resetOtpSentAt &&
      Date.now() - user.resetOtpSentAt.getTime() <
        RESET_OTP_RESEND_SECONDS * 1000
    ) {
      return response;
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    user.resetOtpHash = this.hash(otp);
    user.resetOtpExpiresAt = new Date(
      Date.now() + RESET_OTP_EXPIRY_MINUTES * 60000,
    );
    user.resetOtpSentAt = new Date();
    user.resetOtpAttempts = 0;
    await user.save();

    await this.messagingService.sendTemplate({
      channel: 'email',
      slug: TEMPLATE_SLUGS.ADMIN_PASSWORD_RESET_OTP,
      to: user.email,
      variables: {
        name: user.name,
        otp,
        expiryMinutes: RESET_OTP_EXPIRY_MINUTES,
      },
    });
    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }
    const invalid = new BadRequestException('Invalid or expired code');
    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase().trim(),
      isDeleted: false,
    });
    if (
      !user?.resetOtpHash ||
      !user.resetOtpExpiresAt ||
      user.resetOtpExpiresAt.getTime() < Date.now()
    ) {
      throw invalid;
    }
    if (user.resetOtpAttempts >= RESET_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many wrong codes. Request a new one.');
    }

    const given = Buffer.from(this.hash(dto.otp));
    const stored = Buffer.from(user.resetOtpHash);
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
      user.resetOtpAttempts += 1;
      await user.save();
      throw invalid;
    }

    user.password = await this.hashPassword(dto.newPassword);
    user.resetOtpHash = null;
    user.resetOtpExpiresAt = null;
    user.resetOtpAttempts = 0;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await this.clearSession(user, true);

    return {
      success: true,
      message: 'Password has been reset. Please log in.',
    };
  }

  async findLoginHistory(
    filter: Pagination & {
      userId?: string;
      success?: boolean;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const query: Record<string, any> = {};
    if (filter.userId) query.user = filter.userId;
    if (filter.success !== undefined) query.success = filter.success;
    if (filter.search) {
      query.$or = [
        { email: { $regex: filter.search, $options: 'i' } },
        { ip: { $regex: filter.search, $options: 'i' } },
      ];
    }
    if (filter.startDate || filter.endDate) {
      query.createdAt = {};
      if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
    }
    return this.globalService.paginate<LoginHistory>({
      model: this.loginHistoryModel,
      query,
      pagination: filter,
      populate: 'user',
    });
  }

  /** Bump tokenVersion (optional) and drop the refresh token. Saves the doc. */
  async clearSession(user: UserDocument, revokeAccessTokens: boolean) {
    user.refresh_token = null;
    user.refresh_token_expires_at = null;
    if (revokeAccessTokens) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }
    await user.save();
  }

  /** Fresh token pair, e.g. after the user changes their own password. */
  async issueTokens(user: UserDocument) {
    return {
      token: this.signAccessToken(user),
      ...(await this.issueRefreshToken(user)),
    };
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, await bcrypt.genSalt());
  }

  private signAccessToken(user: UserDocument) {
    const payload: AdminJwtPayload = {
      id: user._id.toString(),
      v: user.tokenVersion || 0,
    };
    return this.jwtService.sign(payload);
  }

  private async issueRefreshToken(user: UserDocument) {
    const refreshExpiresIn = resolveAdminRefreshExpiresIn(
      this.configService.get<string>('ADMIN_JWT_REFRESH_EXPIRES_IN'),
    );
    const refreshToken = randomBytes(48).toString('hex');
    await this.userModel.findByIdAndUpdate(user._id, {
      refresh_token: this.hash(refreshToken),
      refresh_token_expires_at: new Date(
        Date.now() + parseDurationToMs(refreshExpiresIn),
      ),
    });

    const expiresIn = this.accessExpiresIn();
    return {
      refreshToken,
      expiresIn,
      expiresInSeconds: Math.floor(parseDurationToMs(expiresIn) / 1000),
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

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async recordLogin(
    user: UserDocument | null,
    email: string,
    result: string,
    meta: RequestMeta,
  ) {
    await this.loginHistoryModel.create({
      user: user?._id ?? null,
      email,
      success: result === 'success',
      result,
      ip: meta.ip,
      userAgent: meta.userAgent.slice(0, 300),
    });
  }
}
