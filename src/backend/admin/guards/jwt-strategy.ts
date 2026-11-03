import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from '../admin.service';

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

  async validate(payload: { id: string }) {
    const admin = await this.adminService.jwtFindOneById(payload.id);
    if (!admin) {
      throw new UnauthorizedException(
        'You are not authorized to perform the operation',
      );
    }
    return admin;
  }
}
