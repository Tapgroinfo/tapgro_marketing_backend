import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../db/schemas/user.schema';
import { Role, RoleSchema } from '../../db/schemas/role.schema';
import { PermissionSchema } from '../../db/schemas/permission.schema';
import {
  LoginHistory,
  LoginHistorySchema,
} from '../../db/schemas/loginHistory.schema';
import { JwtStrategy } from './guards/jwt-strategy';
import { AdminController } from './admin.controller';
import { AuthController } from './auth.controller';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { resolveAdminAccessExpiresIn } from '../../utils/admin-jwt.constants';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtKey = configService.get<string>('ADMIN_JWT_KEY');
        if (!jwtKey) {
          throw new Error('ADMIN_JWT_KEY missing');
        }
        const expiresIn = resolveAdminAccessExpiresIn(
          configService.get<string>('ADMIN_JWT_EXPIRES_IN'),
        );
        return {
          secret: jwtKey,
          signOptions: {
            expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: 'Permission', schema: PermissionSchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
    ]),
  ],
  controllers: [AuthController, AdminController],
  providers: [AdminService, AuthService, JwtStrategy],
  exports: [AdminService, AuthService, JwtModule],
})
export class AdminModule {}
