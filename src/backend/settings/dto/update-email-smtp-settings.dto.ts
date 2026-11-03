import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateEmailSmtpSettingsDto {
  @ApiPropertyOptional({ description: 'Enable SMTP outbound mail' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 'smtp.gmail.com' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({
    description: 'Use TLS (true for port 465)',
  })
  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Leave blank or ******** to keep existing password',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'TapGro' })
  @IsOptional()
  @IsString()
  fromName?: string;

  @ApiPropertyOptional({ example: 'noreply@tapgro.com' })
  @IsOptional()
  @IsString()
  fromEmail?: string;
}
