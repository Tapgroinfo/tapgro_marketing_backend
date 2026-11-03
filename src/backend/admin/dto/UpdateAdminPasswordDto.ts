import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UpdateAdminPasswordDto {
  @ApiProperty({
    type: String,
    description: 'This is a Old Password required property',
  })
  @IsNotEmpty({ message: 'This is a Old Password required property' })
  oldPassword: string;

  @ApiProperty({
    type: String,
    description: 'This is a New Password required property',
  })
  @IsNotEmpty({ message: 'This is a New Password required property' })
  newPassword: string;

  @ApiProperty({
    type: String,
    description: 'This is a Confirm Password required property',
  })
  @IsNotEmpty({ message: 'This is a Confirm Password required property' })
  confirmPassword: string;
}
