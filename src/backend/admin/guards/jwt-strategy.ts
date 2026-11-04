import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from '../admin.service';
import type { AdminJwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'adminjwt') {
  constructor(
    configService: ConfigService,
    private readonly adminService: AdminService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('ADMIN_JWT_KEY')!,
    });
  }

  async validate(payload: AdminJwtPayload) {
    const admin = await this.adminService.jwtFindOneById(payload.id);
    if (!admin || (admin.tokenVersion || 0) !== (payload.v || 0)) {
      throw new UnauthorizedException(
        'Session is no longer valid. Please log in again.',
      );
    }
    return admin;
  }
}
