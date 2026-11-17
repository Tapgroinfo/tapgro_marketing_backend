import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateSocialProfileDto {
  @ApiProperty({
    example: 'Glow Salon — Andheri',
    description: 'Required. Same as Zernio “Profile Name”.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Pilot salon in Andheri',
    description: 'Optional description (Zernio description).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: '#F8A5A5',
    description: 'Optional accent color hex (Zernio color picker).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
    message: 'color must be a hex like #F8A5A5',
  })
  color?: string;

  @ApiPropertyOptional({
    example: 'Asia/Kolkata',
    description:
      'IANA timezone for new posts (Zernio default timezone). Asia/Calcutta is accepted as an alias of Asia/Kolkata.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Id in another TapGro system (e.g. salon id)',
  })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional({
    description:
      'Link this Zernio profile to a customer-app user (one profile per customer).',
    example: '665f1c0a9e2b5af0012ab34cd',
  })
  @IsOptional()
  @IsMongoId()
  customerId?: string;
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

  @ApiPropertyOptional({ example: '#F8A5A5' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
    message: 'color must be a hex like #F8A5A5',
  })
  color?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Attach / reassign the profile to a customer. Send null to unlink.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsMongoId()
  customerId?: string | null;
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
