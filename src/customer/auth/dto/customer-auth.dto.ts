import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '9876543210',
    description: '10-digit Indian mobile (+91 prefix optional)',
  })
  @IsNotEmpty()
  @IsString()
  mobile: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  mobile: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;

  @ApiPropertyOptional({
    example: 'Priya Sharma',
    description: 'Used when this mobile signs up for the first time',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Glow Salon' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  businessName?: string;
}

export class CustomerRefreshDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'Priya Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'priya@example.com' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== '')
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Glow Salon' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional({ example: 'salon' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessCategory?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
