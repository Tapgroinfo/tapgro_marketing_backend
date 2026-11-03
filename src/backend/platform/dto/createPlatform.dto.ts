import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { PLATFORM_CAPABILITIES } from '../../../utils/platform.constants';

export class CreatePlatformDto {
  @ApiProperty({ example: 'Facebook Page' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'facebook', description: 'Unique key' })
  @IsNotEmpty()
  @Matches(/^[a-z0-9_-]+$/i, {
    message: 'Slug may contain only letters, numbers, - and _',
  })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiPropertyOptional({
    isArray: true,
    enum: PLATFORM_CAPABILITIES,
    example: ['publish', 'analytics', 'comments'],
  })
  @IsOptional()
  @IsArray()
  @IsIn([...PLATFORM_CAPABILITIES], { each: true })
  capabilities?: string[];

  @ApiPropertyOptional({
    default: false,
    description: 'Whether salons can connect this platform',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
