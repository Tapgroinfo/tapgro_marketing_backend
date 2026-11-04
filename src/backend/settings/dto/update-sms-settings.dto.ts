import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSmsSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Leave blank or ******** to keep existing password',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'TAPGRO' })
  @IsOptional()
  @IsString()
  senderId?: string;

  @ApiPropertyOptional({ example: 'https://api.smartping.ai/fe/api/v1/send' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'DLT principal entity id' })
  @IsOptional()
  @IsString()
  dltPrincipalEntityId?: string;

  @ApiPropertyOptional({ description: 'DLT telemarketer id' })
  @IsOptional()
  @IsString()
  dltTelemarketerId?: string;
}
