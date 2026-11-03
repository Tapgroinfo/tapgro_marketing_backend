import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('Legal Public')
@Controller('/api/public/v1')
export class PublicLegalController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('legal')
  @ApiOperation({ summary: 'Privacy Policy + Terms & Conditions (HTML)' })
  getAll() {
    return this.settingsService.getPublicLegal();
  }

  @Get('legal/privacy-policy')
  @ApiOperation({ summary: 'Privacy Policy (HTML)' })
  getPrivacyPolicy() {
    return this.settingsService.getPublicPrivacyPolicy();
  }

  @Get('legal/terms-and-conditions')
  @ApiOperation({ summary: 'Terms and Conditions (HTML)' })
  getTermsAndConditions() {
    return this.settingsService.getPublicTermsAndConditions();
  }
}
