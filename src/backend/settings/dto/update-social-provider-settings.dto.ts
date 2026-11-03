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
}
