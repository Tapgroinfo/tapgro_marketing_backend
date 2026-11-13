import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { SOCIAL_PROVIDERS } from '../../../utils/platform.constants';

export class UpdateSocialProviderSettingsDto {
  @ApiPropertyOptional({ description: 'Enable social media features' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: SOCIAL_PROVIDERS, default: 'zernio' })
  @IsOptional()
  @IsIn([...SOCIAL_PROVIDERS])
  provider?: string;

  @ApiPropertyOptional({
    description: 'Leave blank or ******** to keep existing key',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'Leave blank or ******** to keep existing secret',
  })
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiPropertyOptional({
    description: "Override the provider's default API base URL",
  })
  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @ApiPropertyOptional({
    example: 'https://admin.tapgro.com/social/channels',
    description:
      'Admin panel page the browser returns to after connecting a channel. Gets ?social_connect=success|error&platform=&channelId=&message=',
  })
  @IsOptional()
  @IsString()
  panelRedirectUrl?: string;

  @ApiPropertyOptional({
    example: 'https://app.tapgro.com/social',
    description:
      'Customer app page or deep link to return to after a customer connects a channel. Same query params as panelRedirectUrl.',
  })
  @IsOptional()
  @IsString()
  customerRedirectUrl?: string;

  @ApiPropertyOptional({
    example: 'TapGro',
    description: 'Brand on the Zernio connect welcome screen',
  })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiPropertyOptional({ description: 'Logo URL for the welcome screen' })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}
