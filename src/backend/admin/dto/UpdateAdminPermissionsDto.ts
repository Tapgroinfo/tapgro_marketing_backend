import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ModulePermissionDto } from '../../role/dto/ModulePermission.dto';

export class UpdateAdminPermissionsDto {
  @ApiProperty({
    type: [ModulePermissionDto],
    description: 'Custom permission overrides for the user',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePermissionDto)
  permissions: ModulePermissionDto[];
}
