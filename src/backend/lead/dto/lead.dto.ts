import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { LEAD_SOURCES, LEAD_STATUSES } from '../../../db/schemas/lead.schema';

export class CreateLeadDto {
  @ApiProperty({ example: 'Riya Mehta' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @Matches(/^\+?\d{7,15}$/, { message: 'Enter a valid phone number' })
  mobile?: string;

  @ApiPropertyOptional({ example: 'riya@example.com' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== '')
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Wants bridal makeup on 12 Dec' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ enum: LEAD_SOURCES, default: 'manual' })
  @IsOptional()
  @IsIn([...LEAD_SOURCES])
  source?: string;

  @ApiPropertyOptional({
    example: 'instagram',
    description: 'Platform slug (facebook, instagram, google_business…)',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ enum: LEAD_STATUSES, default: 'new' })
  @IsOptional()
  @IsIn([...LEAD_STATUSES])
  status?: string;

  @ApiPropertyOptional({ example: '2026-11-10T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class AddLeadNoteDto {
  @ApiProperty({ example: 'Called, will visit on Saturday' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  text: string;
}
