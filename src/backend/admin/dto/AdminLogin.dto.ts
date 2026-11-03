import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    type: String,
    example: 'admin@tapgropartner.com',
    description: 'This is a email required property',
  })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    example: '12345678',
    description: 'This is a required property',
  })
  @IsNotEmpty()
  password: string;
}
