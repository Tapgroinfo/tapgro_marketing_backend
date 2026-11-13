import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import {
  Customer,
  CustomerDocument,
  CustomerOtp,
} from '../../db/schemas/customer.schema';
import { CustomerService } from '../../backend/customer/customer.service';
import { MessagingService } from '../../backend/messaging/messaging.service';
import { normalizeIndianMobile, maskMobile } from '../../utils/mobile.util';
import { parseDurationToMs } from '../../utils/admin-jwt.constants';
import { TEMPLATE_SLUGS } from '../../utils/template.constants';
import {
  CustomerJwtPayload,
  DEFAULT_CUSTOMER_ACCESS_EXPIRES_IN,
  DEFAULT_CUSTOMER_REFRESH_EXPIRES_IN,
  OTP_EXPIRY_SECONDS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_MAX_VERIFY_ATTEMPTS,
  OTP_RESEND_SECONDS,
} from './customer-auth.constants';
import { SendOtpDto, VerifyOtpDto } from './dto/customer-auth.dto';

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(CustomerOtp.name)
    private readonly otpModel: Model<CustomerOtp>,
    private readonly customerService: CustomerService,
    private readonly messagingService: MessagingService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ---------- OTP ----------

  async sendOtp(dto: SendOtpDto) {
    const mobile = normalizeIndianMobile(dto.mobile);
    const existing = await this.customerModel.findOne({
      mobile,
      isDeleted: false,
    });
    if (existing?.status === 'blocked') {
      throw new ForbiddenException('This account is blocked. Contact support.');
    }

    const now = Date.now();
    const row =
      (await this.otpModel.findOne({ mobile })) ??
      new this.otpModel({ mobile });

    if (
      row.lastSentAt &&
      now - row.lastSentAt.getTime() < OTP_RESEND_SECONDS * 1000
    ) {
      const wait = Math.ceil(
        (OTP_RESEND_SECONDS * 1000 - (now - row.lastSentAt.getTime())) / 1000,
      );
      throw new HttpException(
        {
          message: `Please wait ${wait}s before requesting a new OTP`,
          retryAfter: wait,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (
      !row.windowStartedAt ||
      now - row.windowStartedAt.getTime() > 3600_000
    ) {
      row.windowStartedAt = new Date(now);
      row.sendCount = 0;
    }
    if (row.sendCount >= OTP_MAX_SENDS_PER_HOUR) {
      throw new HttpException(
        'Too many OTP requests. Try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    row.otpHash = this.hashOtp(mobile, otp);
    row.expiresAt = new Date(now + OTP_EXPIRY_SECONDS * 1000);
    row.attempts = 0;
    row.lastSentAt = new Date(now);
    row.sendCount += 1;
    await row.save();

    const delivered = await this.deliverOtp(mobile, otp);
    const testMode = this.isTestMode();
    if (!delivered && !testMode) {
      throw new ServiceUnavailableException(
        'Could not send the OTP right now. Please try again shortly.',
      );
    }

    return {
      success: true,
      message: delivered
        ? 'OTP sent'
        : 'OTP generated (test mode — not delivered)',
      data: {
        mobile: maskMobile(mobile),
        isNewCustomer: !existing,
        expiresIn: OTP_EXPIRY_SECONDS,
        resendAfter: OTP_RESEND_SECONDS,
        deliveredVia: delivered || null,
        ...(testMode ? { devOtp: otp } : {}),
      },
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const mobile = normalizeIndianMobile(dto.mobile);
    const row = await this.otpModel.findOne({ mobile });
    const invalid = new BadRequestException('Invalid or expired OTP');

    if (
      !row?.otpHash ||
      !row.expiresAt ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw invalid;
    }
    if (row.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      throw new HttpException(
        'Too many wrong attempts. Request a new OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const given = Buffer.from(this.hashOtp(mobile, dto.otp));
    const stored = Buffer.from(row.otpHash);
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
      row.attempts += 1;
      await row.save();
      throw invalid;
    }
    // One-time use
    row.otpHash = null;
    row.expiresAt = null;
    await row.save();

    let customer = await this.customerModel.findOne({
      mobile,
      isDeleted: false,
    });
    const isNewCustomer = !customer;
    if (!customer) {
      customer = new this.customerModel({
        mobile,
        name: dto.name || '',
        businessName: dto.businessName || '',
      });
    } else if (customer.status === 'blocked') {
      throw new ForbiddenException('This account is blocked. Contact support.');
    }

    await this.customerService.applyDirectory(customer);
    customer.lastLogin = new Date();
    await customer.save();

    return {
      success: true,
      message: isNewCustomer ? 'Account created' : 'Logged in',
      ...(await this.issueTokens(customer)),
      data: {
        isNewCustomer,
        profileComplete: !!(customer.name && customer.businessName),
        customer: this.customerService.toSafe(customer),
      },
    };
  }

  // ---------- sessions ----------

  async refresh(refreshToken: string) {
    const customer = await this.customerModel.findOne({
      refreshTokenHash: this.hash(refreshToken),
      isDeleted: false,
    });
    if (
      !customer ||
      customer.status === 'blocked' ||
      !customer.refreshTokenExpiresAt ||
      customer.refreshTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    const expiresIn = this.accessExpiresIn();
    return {
      success: true,
      token: this.signAccessToken(customer),
      refreshToken,
      expiresIn,
      expiresInSeconds: Math.floor(parseDurationToMs(expiresIn) / 1000),
    };
  }

  async logout(customerId: string, everywhere = false) {
    const update: Record<string, unknown> = {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    };
    if (everywhere) update.$inc = { tokenVersion: 1 };
    await this.customerModel.updateOne({ _id: customerId }, update);
    return {
      success: true,
      message: everywhere ? 'Logged out from all devices' : 'Logged out',
    };
  }

  /** Used by the JWT strategy. */
  async validatePayload(payload: CustomerJwtPayload) {
    if (payload?.typ !== 'customer') return null;
    const customer = await this.customerModel.findOne({
      _id: payload.id,
      isDeleted: false,
      status: 'active',
    });
    if (!customer || (customer.tokenVersion || 0) !== (payload.v || 0))
      return null;
    return customer;
  }

  // ---------- helpers ----------

  /** SMS first, WhatsApp as fallback. Returns the channel used or null. */
  private async deliverOtp(mobile: string, otp: string) {
    const vars = { otp, expiryMinutes: Math.round(OTP_EXPIRY_SECONDS / 60) };
    const sms = await this.messagingService.sendTemplate({
      channel: 'sms',
      slug: TEMPLATE_SLUGS.CUSTOMER_LOGIN_OTP,
      to: `91${mobile}`,
      variables: vars,
    });
    if (sms.sent) return 'sms';
    const whatsapp = await this.messagingService.sendTemplate({
      channel: 'whatsapp',
      slug: TEMPLATE_SLUGS.CUSTOMER_LOGIN_OTP,
      to: `91${mobile}`,
      variables: vars,
    });
    if (whatsapp.sent) return 'whatsapp';
    this.logger.warn(
      `OTP not delivered to ${maskMobile(mobile)}: ${sms.reason}`,
    );
    return null;
  }

  private async issueTokens(customer: CustomerDocument) {
    const refreshToken = randomBytes(48).toString('hex');
    const refreshExpiresIn =
      this.configService.get<string>('CUSTOMER_REFRESH_EXPIRES_IN') ||
      DEFAULT_CUSTOMER_REFRESH_EXPIRES_IN;
    customer.refreshTokenHash = this.hash(refreshToken);
    customer.refreshTokenExpiresAt = new Date(
      Date.now() + parseDurationToMs(refreshExpiresIn),
    );
    await customer.save();

    const expiresIn = this.accessExpiresIn();
    return {
      token: this.signAccessToken(customer),
      refreshToken,
      expiresIn,
      expiresInSeconds: Math.floor(parseDurationToMs(expiresIn) / 1000),
      refreshExpiresIn,
    };
  }

  private signAccessToken(customer: CustomerDocument) {
    const payload: CustomerJwtPayload = {
      id: customer._id.toString(),
      v: customer.tokenVersion || 0,
      typ: 'customer',
    };
    return this.jwtService.sign(payload);
  }

  private accessExpiresIn() {
    return (
      this.configService.get<string>('CUSTOMER_JWT_EXPIRES_IN') ||
      DEFAULT_CUSTOMER_ACCESS_EXPIRES_IN
    );
  }

  /** Test mode is never honoured in production. */
  private isTestMode() {
    const env = (
      this.configService.get<string>('NODE_ENV') || ''
    ).toLowerCase();
    return (
      env !== 'production' &&
      this.configService.get<string>('CUSTOMER_OTP_TEST_MODE') === 'true'
    );
  }

  private hashOtp(mobile: string, otp: string) {
    return this.hash(`${mobile}:${otp}`);
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
