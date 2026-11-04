import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@tapgro.com' })
  @IsEmail({}, { message: 'A valid email is required' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'admin@tapgro.com' })
  @IsEmail({}, { message: 'A valid email is required' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Confirm password is required' })
  confirmPassword: string;
}

/** Super admin sets another admin's password. */
export class AdminSetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}

export class UpdateAdminStatusDto {
  @ApiProperty({ description: 'false disables login and ends all sessions' })
  @IsBoolean()
  status: boolean;
}
