import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ModulePermissionDto } from './ModulePermission.dto';

export class UpdateRoleDto {
  @ApiProperty({
    type: String,
    description: 'Unique name of the role',
  })
  @IsNotEmpty()
  @IsString()
  role: string;

  @ApiProperty({
    type: [ModulePermissionDto],
    default: [],
    description: 'List of structured module permissions',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePermissionDto)
  permissions: ModulePermissionDto[];
}
