import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';

export class ModulePermissionDto {
  @ApiProperty({
    type: String,
    description: 'Name/slug of the module',
    example: 'platform',
  })
  @IsNotEmpty()
  @IsString()
  module: string;

  @ApiProperty({
    type: Boolean,
    description: 'Grant creation permission',
    default: false,
  })
  @IsBoolean()
  is_create: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Grant viewing permission',
    default: false,
  })
  @IsBoolean()
  is_view: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Grant editing permission',
    default: false,
  })
  @IsBoolean()
  is_edit: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Grant deleting permission',
    default: false,
  })
  @IsBoolean()
  is_delete: boolean;
}
