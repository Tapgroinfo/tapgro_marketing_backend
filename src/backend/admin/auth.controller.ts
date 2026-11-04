import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminLoginDto } from './dto/AdminLogin.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/PasswordReset.dto';
import { AuthService } from './auth.service';
import { JwtOnAuthGuard } from './guards/jwt-guard';
import { AuthAdmin } from './decorators/adminAuth.decorator';
import { ReqMeta } from '../../utils/decorator/request-meta.decorator';
import type { RequestMeta } from './admin.constants';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { StrictThrottle } from '../../utils/throttle.constants';

@ApiTags('Auth')
@ApiBearerAuth('backendBearerAuth')
@Controller('/api/backend/v1')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @StrictThrottle()
  @Post('adminLogin')
  @ApiOperation({
    summary: 'Login',
    description: `Locks the account for 15 minutes after 5 wrong passwords.`,
  })
  login(@Body() dto: AdminLoginDto, @ReqMeta() meta: RequestMeta) {
    return this.authService.login(dto, meta);
  }

  @Post('refreshToken')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Send the stored refresh_token to get a new access token without logging in again.',
  })
  refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  @StrictThrottle()
  @Post('forgotPassword')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Email a 6-digit reset code',
    description:
      'Always returns success (does not reveal whether the email exists). Code valid 10 minutes; resend allowed after 60 seconds.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @StrictThrottle()
  @Post('resetPassword')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset password with the emailed code',
    description: 'Logs out all existing sessions.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtOnAuthGuard)
  @Post('adminLogout')
  @ApiOperation({ summary: 'Logout this device (clears refresh token)' })
  logout(@AuthAdmin() authUser: any) {
    return this.authService.logout(authUser.id);
  }

  @UseGuards(JwtOnAuthGuard)
  @Post('adminLogoutAll')
  @ApiOperation({
    summary: 'Logout everywhere',
    description: 'Revokes every access and refresh token of the current admin.',
  })
  logoutAll(@AuthAdmin() authUser: any) {
    return this.authService.logoutAllSessions(authUser.id);
  }

  @UseGuards(JwtOnAuthGuard)
  @Get('adminProfile/loginHistory')
  @PaginationDecorator()
  @ApiOperation({ summary: 'My recent login attempts' })
  async myLoginHistory(
    @AuthAdmin() authUser: any,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
  ) {
    const result = await this.authService.findLoginHistory({
      userId: authUser.id,
      limit,
      page,
    });
    return { success: true, ...result };
  }
}
