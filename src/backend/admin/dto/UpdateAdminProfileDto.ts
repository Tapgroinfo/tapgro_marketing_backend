import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

export class UpdateAdminProfileDto {
  @ApiProperty({
    type: String,
    description: 'Name of the admin',
  })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    description: 'Phone number of the admin',
  })
  @IsNotEmpty({ message: 'Phone is required' })
  @IsString()
  phone: string;

  @ApiProperty({
    type: String,
    description: 'Email address of the admin',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Profile image URL from POST /upload',
  })
  @IsOptional()
  @IsString()
  image?: string;
}
