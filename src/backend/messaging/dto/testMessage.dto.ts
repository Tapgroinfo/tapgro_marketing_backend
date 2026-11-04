import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class TestMessageDto {
  @ApiProperty({ description: 'Template to send (decides the channel)' })
  @IsMongoId()
  templateId: string;

  @ApiProperty({ example: 'you@example.com', description: 'Email or phone' })
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { name: 'Priya', otp: '123456', expiryMinutes: '10' },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
