import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateLegalSettingsDto {
  @ApiPropertyOptional({
    description: 'Full Privacy Policy HTML content',
  })
  @IsOptional()
  @IsString()
  privacyPolicyHtml?: string;

  @ApiPropertyOptional({
    description: 'Full Terms & Conditions HTML content',
  })
  @IsOptional()
  @IsString()
  termsAndConditionsHtml?: string;

  @ApiPropertyOptional({
    example: '2026-08-13',
    description: 'Optional last-updated date for privacy policy',
  })
  @IsOptional()
  @IsString()
  privacyPolicyUpdatedAt?: string;

  @ApiPropertyOptional({
    example: '2026-08-13',
    description: 'Optional last-updated date for terms & conditions',
  })
  @IsOptional()
  @IsString()
  termsAndConditionsUpdatedAt?: string;
}
