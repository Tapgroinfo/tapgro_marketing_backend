import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    type: String,
    description: 'This is a Refresh Token required property',
  })
  @IsNotEmpty({ message: 'The Refresh token is required' })
  refresh_token: string;
}
