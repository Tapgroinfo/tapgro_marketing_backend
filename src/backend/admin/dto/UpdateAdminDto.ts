import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModulePermissionDto } from '../../role/dto/ModulePermission.dto';

export class UpdateAdminDto {
  @ApiProperty({
    type: String,
    required: false,
    description: 'Name of the admin user',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'Email address of the admin user',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'Phone number of the admin user',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'Role ObjectId assigned to the user',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: 'Status of the admin (active/inactive)',
  })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiProperty({
    type: [ModulePermissionDto],
    required: false,
    description: 'Direct permission overrides for this admin user',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePermissionDto)
  permissions?: ModulePermissionDto[];
}
