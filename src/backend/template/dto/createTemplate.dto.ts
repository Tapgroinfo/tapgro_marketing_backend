import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { TEMPLATE_CHANNELS } from '../../../db/schemas/messageTemplate.schema';

export class CreateTemplateDto {
  @ApiProperty({ enum: TEMPLATE_CHANNELS })
  @IsIn([...TEMPLATE_CHANNELS])
  channel: string;

  @ApiProperty({ example: 'salon_welcome' })
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Slug may contain only lowercase letters, numbers and _',
  })
  slug: string;

  @ApiProperty({ example: 'Salon welcome email' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Email only' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: '<p>Hi {{name}}</p>' })
  @IsNotEmpty()
  @IsString()
  body: string;

  @ApiPropertyOptional({ type: [String], example: ['name'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({
    description: 'SMS: DLT content id. WhatsApp: provider template code.',
  })
  @IsOptional()
  @IsString()
  providerTemplateId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
