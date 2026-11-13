import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StrictThrottle } from '../../utils/throttle.constants';
import type { CustomerDocument } from '../../db/schemas/customer.schema';
import { CustomerAuthService } from './customer-auth.service';
import { CurrentCustomer, CustomerJwtGuard } from './customer-auth.guard';
import {
  CustomerRefreshDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/customer-auth.dto';

@ApiTags('Customer Auth')
@Controller('/api/customer/v1/auth')
export class CustomerAuthController {
  constructor(private readonly authService: CustomerAuthService) {}

  @StrictThrottle()
  @Post('send-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Step 1 — send OTP to mobile',
    description:
      'Works for login and signup. Resend after 30s, max 5 per hour. `isNewCustomer` tells the app to ask for name / business name on step 2. In test mode (non-production, CUSTOMER_OTP_TEST_MODE=true) the response includes `devOtp`.',
  })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @StrictThrottle()
  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Step 2 — verify OTP, get tokens',
    description:
      'Creates the account on first login. Returns token (Bearer for customerBearerAuth) and refreshToken. TapGro users are flagged automatically.',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'New access token from refreshToken' })
  refresh(@Body() dto: CustomerRefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth('customerBearerAuth')
  @UseGuards(CustomerJwtGuard)
  @Post('logout')
  @HttpCode(200)
  logout(@CurrentCustomer() customer: CustomerDocument) {
    return this.authService.logout(customer.id);
  }

  @ApiBearerAuth('customerBearerAuth')
  @UseGuards(CustomerJwtGuard)
  @Post('logout-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log out from every device' })
  logoutAll(@CurrentCustomer() customer: CustomerDocument) {
    return this.authService.logout(customer.id, true);
  }
}
