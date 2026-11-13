import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CUSTOMER_STATUSES } from '../../../db/schemas/customer.schema';

export class AdminUpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_o, v) => v !== '')
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional({ example: 'salon' })
  @IsOptional()
  @IsString()
  businessCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;
}

export class UpdateCustomerStatusDto {
  @ApiProperty({ enum: CUSTOMER_STATUSES })
  @IsIn([...CUSTOMER_STATUSES])
  status: string;
}

export class UpdateCustomerTapgroDto {
  @ApiProperty({ description: 'Mark / unmark as an existing TapGro user' })
  @IsBoolean()
  isTapgroUser: boolean;

  @ApiPropertyOptional({ description: 'Id in TapGro Hub (salon / client id)' })
  @IsOptional()
  @IsString()
  tapgroRef?: string;
}

export class TapgroMemberDto {
  @ApiProperty({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  mobile: string;

  @ApiPropertyOptional({ example: 'HUBCLIENT-1024' })
  @IsOptional()
  @IsString()
  tapgroRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessName?: string;
}

export class ImportTapgroMembersDto {
  @ApiProperty({ type: [TapgroMemberDto], description: 'Up to 5,000 per call' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => TapgroMemberDto)
  members: TapgroMemberDto[];
}
