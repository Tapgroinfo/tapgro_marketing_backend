import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({ example: 'How do I connect Instagram?' })
  @IsNotEmpty()
  @IsString()
  question: string;

  @ApiProperty({ example: 'Open Social Accounts and tap Connect.' })
  @IsNotEmpty()
  @IsString()
  answer: string;

  @ApiPropertyOptional({ example: 'general' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class CreateBannerDto {
  @ApiProperty({ example: 'Diwali offer' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({ description: 'URL from POST /upload' })
  @IsNotEmpty()
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ example: 'home' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: '2026-11-15T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}
export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

export class CreatePageDto {
  @ApiProperty({ example: 'About us' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'about-us' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug may contain only lowercase letters, numbers and -',
  })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
export class UpdatePageDto extends PartialType(CreatePageDto) {}
