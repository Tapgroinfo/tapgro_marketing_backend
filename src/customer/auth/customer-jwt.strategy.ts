import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CustomerAuthService } from './customer-auth.service';
import {
  CUSTOMER_JWT_STRATEGY,
  CustomerJwtPayload,
} from './customer-auth.constants';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  CUSTOMER_JWT_STRATEGY,
) {
  constructor(
    configService: ConfigService,
    private readonly authService: CustomerAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('CUSTOMER_JWT_KEY')!,
    });
  }

  async validate(payload: CustomerJwtPayload) {
    const customer = await this.authService.validatePayload(payload);
    if (!customer) {
      throw new UnauthorizedException(
        'Session is no longer valid. Please log in again.',
      );
    }
    return customer;
  }
}
