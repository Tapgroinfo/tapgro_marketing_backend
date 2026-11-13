import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateSocialProfileDto {
  @ApiProperty({ example: 'Glow Salon — Andheri' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Id in another TapGro system (e.g. salon id)',
  })
  @IsOptional()
  @IsString()
  externalRef?: string;
}

export class UpdateSocialProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ConnectChannelDto {
  @ApiProperty({
    example: 'instagram',
    description:
      'Platform slug from GET /platforms (facebook, instagram, google_business, youtube, meta_ads…). Must be active.',
  })
  @IsNotEmpty()
  @IsString()
  platform: string;
}

export class TestChannelDto {
  @ApiProperty({
    enum: ['health', 'post'],
    description:
      'health = token / permission check (safe). post = publishes a REAL public post on the channel.',
  })
  @IsIn(['health', 'post'])
  mode: 'health' | 'post';

  @ApiPropertyOptional({ example: 'Test post from TapGro ✅' })
  @ValidateIf((o: TestChannelDto) => o.mode === 'post')
  @IsNotEmpty({ message: 'content is required for a test post' })
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({
    description:
      'Public image/video URL (required for Instagram; video required for YouTube/TikTok)',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  mediaUrl?: string;

  @ApiPropertyOptional({ enum: ['image', 'video'], default: 'image' })
  @IsOptional()
  @IsIn(['image', 'video'])
  mediaType?: 'image' | 'video';

  @ApiPropertyOptional({
    description: 'Must be true for mode=post — the post is published publicly.',
  })
  @ValidateIf((o: TestChannelDto) => o.mode === 'post')
  @IsIn([true], {
    message: 'Set confirmPublish=true to publish a real test post',
  })
  confirmPublish?: boolean;
}
