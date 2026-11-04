import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlanLimitDto {
  @ApiProperty({ example: 'max_social_accounts' })
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Limit key may contain only lowercase letters, numbers and _',
  })
  key: string;

  @ApiPropertyOptional({ example: 'Social accounts' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 3, description: '-1 = unlimited' })
  @IsInt()
  @Min(-1)
  value: number;
}

export class CreatePlanDto {
  @ApiProperty({ example: 'Social Starter' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'social-starter' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug may contain only lowercase letters, numbers and -',
  })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 499 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceMonthly: number;

  @ApiPropertyOptional({ example: 4990 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceYearly?: number;

  @ApiPropertyOptional({ default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['Facebook, Instagram & Google', 'Post scheduling'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ type: [PlanLimitDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanLimitDto)
  limits?: PlanLimitDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
