import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    type: String,
    description: 'Human-readable name of the permission module',
    example: 'Platforms',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    description: 'Unique slug, used in guards as `<action>:<slug>`',
    example: 'platform',
  })
  @IsNotEmpty()
  @Matches(/^[a-z0-9_-]+$/i, {
    message: 'Slug may contain only letters, numbers, - and _',
  })
  slug: string;
}
