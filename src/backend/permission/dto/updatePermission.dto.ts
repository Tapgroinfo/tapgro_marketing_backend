import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdatePermissionDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Human-readable name of the permission module',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Unique slug, used in guards as `<action>:<slug>`',
  })
  @IsOptional()
  @Matches(/^[a-z0-9_-]+$/i, {
    message: 'Slug may contain only letters, numbers, - and _',
  })
  slug?: string;
}
