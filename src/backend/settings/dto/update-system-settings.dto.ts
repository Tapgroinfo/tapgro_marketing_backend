import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ description: 'Show maintenance screen to clients' })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: '₹' })
  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @ApiPropertyOptional({ example: 'DD/MM/YYYY' })
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @Matches(VERSION_PATTERN, { message: 'Use semantic version like 1.2.3' })
  androidVersion?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @Matches(VERSION_PATTERN, { message: 'Use semantic version like 1.2.3' })
  iosVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  playStoreUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appStoreUrl?: string;
}
