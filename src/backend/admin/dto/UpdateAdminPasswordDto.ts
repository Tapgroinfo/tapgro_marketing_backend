import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateAdminPasswordDto {
  @ApiProperty({ type: String })
  @IsNotEmpty({ message: 'Old password is required' })
  oldPassword: string;

  @ApiProperty({ type: String, minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;

  @ApiProperty({ type: String })
  @IsNotEmpty({ message: 'Confirm password is required' })
  confirmPassword: string;
}
