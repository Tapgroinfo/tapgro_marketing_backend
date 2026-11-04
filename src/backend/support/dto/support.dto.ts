import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  TICKET_PRIORITIES,
  TICKET_SOURCES,
  TICKET_STATUSES,
} from '../../../db/schemas/supportTicket.schema';

export class CreateTicketDto {
  @ApiProperty({ example: 'Priya Sharma' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'priya@example.com' })
  @IsEmail({}, { message: 'A valid email is required' })
  email: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: 'Instagram not connecting' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional({ example: 'general' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ enum: TICKET_SOURCES, default: 'website' })
  @IsOptional()
  @IsIn([...TICKET_SOURCES])
  source?: string;

  @ApiPropertyOptional({
    description: 'Honeypot — leave empty. Bots that fill it are ignored.',
  })
  @IsOptional()
  @IsString()
  website?: string;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TICKET_STATUSES })
  @IsOptional()
  @IsIn([...TICKET_STATUSES])
  status?: string;

  @ApiPropertyOptional({ enum: TICKET_PRIORITIES })
  @IsOptional()
  @IsIn([...TICKET_PRIORITIES])
  priority?: string;

  @ApiPropertyOptional({ description: 'Admin id, or null to unassign' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsMongoId()
  assignedTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}

export class ReplyTicketDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Internal note — not emailed',
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
