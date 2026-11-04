import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { AuthAdmin } from '../admin/decorators/adminAuth.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { NotificationService } from './notification.service';
import { BroadcastNotificationDto } from './dto/broadcastNotification.dto';

@ApiTags('Notifications')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('notifications')
  @PaginationDecorator()
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiOperation({ summary: 'My notifications (includes unreadCount)' })
  async findMine(
    @AuthAdmin() authUser: any,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('isRead', new ParseBoolPipe({ optional: true })) isRead?: boolean,
    @Query('category') category?: string,
  ) {
    const result = await this.notificationService.findMine(authUser.id, {
      limit,
      page,
      isRead,
      category,
    });
    return { success: true, ...result };
  }

  @Get('notifications/unreadCount')
  async unreadCount(@AuthAdmin() authUser: any) {
    return {
      success: true,
      data: { count: await this.notificationService.unreadCount(authUser.id) },
    };
  }

  @Patch('notifications/readAll')
  markAllRead(@AuthAdmin() authUser: any) {
    return this.notificationService.markAllRead(authUser.id);
  }

  @Patch('notification/:id/read')
  markRead(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.notificationService.markRead(id, authUser.id);
  }

  @Delete('notification/:id')
  remove(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.notificationService.remove(id, authUser.id);
  }

  @RequirePermissions('create:notification')
  @Post('notifications/broadcast')
  @ApiOperation({ summary: 'Send an announcement to all active admins' })
  async broadcast(@Body() dto: BroadcastNotificationDto) {
    const count = await this.notificationService.notifyAdmins({
      ...dto,
      category: 'announcement',
    });
    return {
      success: true,
      message: `Notification sent to ${count} admin(s)`,
    };
  }
}
