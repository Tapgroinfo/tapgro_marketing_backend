import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NOTIFICATION_TYPES } from '../../../db/schemas/adminNotification.schema';

export class BroadcastNotificationDto {
  @ApiProperty({ example: 'Scheduled maintenance tonight' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES, default: 'info' })
  @IsOptional()
  @IsIn([...NOTIFICATION_TYPES])
  type?: 'info' | 'success' | 'warning' | 'error';

  @ApiPropertyOptional({ example: '/settings' })
  @IsOptional()
  @IsString()
  link?: string;
}
