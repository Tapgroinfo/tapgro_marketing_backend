import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { UpdateCompanySettingsDto } from './update-company-settings.dto';
import { UpdateEmailSmtpSettingsDto } from './update-email-smtp-settings.dto';
import { UpdateLegalSettingsDto } from './update-legal-settings.dto';
import { UpdateSocialProviderSettingsDto } from './update-social-provider-settings.dto';
import { UpdateSmsSettingsDto } from './update-sms-settings.dto';
import { UpdateWhatsappSettingsDto } from './update-whatsapp-settings.dto';
import { UpdateSystemSettingsDto } from './update-system-settings.dto';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ type: UpdateCompanySettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCompanySettingsDto)
  company?: UpdateCompanySettingsDto;

  @ApiPropertyOptional({ type: UpdateEmailSmtpSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateEmailSmtpSettingsDto)
  email?: UpdateEmailSmtpSettingsDto;

  @ApiPropertyOptional({ type: UpdateLegalSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateLegalSettingsDto)
  legal?: UpdateLegalSettingsDto;

  @ApiPropertyOptional({ type: UpdateSocialProviderSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSocialProviderSettingsDto)
  socialProvider?: UpdateSocialProviderSettingsDto;

  @ApiPropertyOptional({ type: UpdateSmsSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSmsSettingsDto)
  sms?: UpdateSmsSettingsDto;

  @ApiPropertyOptional({ type: UpdateWhatsappSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateWhatsappSettingsDto)
  whatsapp?: UpdateWhatsappSettingsDto;

  @ApiPropertyOptional({ type: UpdateSystemSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSystemSettingsDto)
  system?: UpdateSystemSettingsDto;
}
