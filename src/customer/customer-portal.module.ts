import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Customer,
  CustomerOtp,
  CustomerOtpSchema,
  CustomerSchema,
} from '../db/schemas/customer.schema';
import { Platform, PlatformSchema } from '../db/schemas/platform.schema';
import { CustomerModule } from '../backend/customer/customer.module';
import { SocialModule } from '../backend/social/social.module';
import { LeadModule } from '../backend/lead/lead.module';
import { CustomerAuthController } from './auth/customer-auth.controller';
import { CustomerAuthService } from './auth/customer-auth.service';
import { CustomerJwtStrategy } from './auth/customer-jwt.strategy';
import { DEFAULT_CUSTOMER_ACCESS_EXPIRES_IN } from './auth/customer-auth.constants';
import { CustomerProfileController } from './app/customer-profile.controller';
import { CustomerSocialController } from './app/customer-social.controller';
import { CustomerLeadController } from './app/customer-lead.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('CUSTOMER_JWT_KEY');
        if (!secret) {
          throw new Error('CUSTOMER_JWT_KEY missing');
        }
        const expiresIn =
          config.get<string>('CUSTOMER_JWT_EXPIRES_IN') ||
          DEFAULT_CUSTOMER_ACCESS_EXPIRES_IN;
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: CustomerOtp.name, schema: CustomerOtpSchema },
      { name: Platform.name, schema: PlatformSchema },
    ]),
    CustomerModule,
    SocialModule,
    LeadModule,
  ],
  controllers: [
    CustomerAuthController,
    CustomerProfileController,
    CustomerSocialController,
    CustomerLeadController,
  ],
  providers: [CustomerAuthService, CustomerJwtStrategy],
})
export class CustomerPortalModule {}
