import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AdminCreateDto {
  @ApiProperty({ type: String, example: 'Priya Sharma' })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiProperty({ type: String, example: 'priya@tapgro.com' })
  @IsEmail({}, { message: 'A valid email is required' })
  email: string;

  @ApiPropertyOptional({ type: String, example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ type: String, description: 'Role ObjectId' })
  @IsMongoId({ message: 'A valid role id is required' })
  role: string;

  @ApiProperty({ type: String, minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
