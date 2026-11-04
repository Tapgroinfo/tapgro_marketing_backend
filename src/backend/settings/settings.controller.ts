import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { AuthAdmin } from '../admin/decorators/adminAuth.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('Settings')
@Controller('/api/backend/v1')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('settings/public')
  @ApiOperation({
    summary: 'Public settings (no auth)',
    description:
      'Company name, maintenance mode, app versions, currency/timezone and legal links.',
  })
  getPublic() {
    return this.settingsService.getPublicSettings();
  }

  @ApiBearerAuth('backendBearerAuth')
  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('read:settings')
  @Get('settings')
  @ApiOperation({ summary: 'Get settings (secrets masked)' })
  getAll() {
    return this.settingsService.getAll();
  }

  @ApiBearerAuth('backendBearerAuth')
  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('update:settings')
  @Put('settings')
  @ApiOperation({
    summary: 'Update settings',
    description:
      'Partial update by section: company, email, legal, socialProvider, sms, whatsapp, system. Send ******** (or omit) for secrets to keep the stored value.',
  })
  update(@Body() dto: UpdateSettingsDto, @AuthAdmin() authUser: any) {
    return this.settingsService.update(dto, authUser.id);
  }
}
