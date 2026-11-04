import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { ReqMeta } from '../../utils/decorator/request-meta.decorator';
import { StrictThrottle } from '../../utils/throttle.constants';
import { Sort } from '../../utils/pagination';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../db/schemas/supportTicket.schema';
import { SupportService } from './support.service';
import {
  CreateTicketDto,
  ReplyTicketDto,
  UpdateTicketDto,
} from './dto/support.dto';

@ApiTags('Support')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @RequirePermissions('read:support')
  @Get('tickets')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'status', required: false, enum: TICKET_STATUSES })
  @ApiQuery({ name: 'priority', required: false, enum: TICKET_PRIORITIES })
  @ApiQuery({
    name: 'assignedTo',
    required: false,
    type: String,
    description: 'Admin id, or "none" for unassigned',
  })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.supportService.findAll({
      limit,
      page,
      search,
      sort_attr,
      sort,
      status,
      priority,
      assignedTo,
      category,
      startDate,
      endDate,
    });
    return {
      success: true,
      counts: await this.supportService.countByStatus(),
      ...result,
    };
  }

  @RequirePermissions('read:support')
  @Get('ticket/:id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.supportService.findOne(id) };
  }

  @RequirePermissions('update:support')
  @Put('ticket/:id')
  @ApiOperation({ summary: 'Change status / priority / assignee' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.supportService.update(id, dto, {
      id: authUser.id,
      name: authUser.name,
    });
  }

  @RequirePermissions('update:support')
  @Post('ticket/:id/reply')
  @ApiOperation({
    summary: 'Reply (emailed to requester) or add an internal note',
  })
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.supportService.reply(id, dto, {
      id: authUser.id,
      name: authUser.name,
    });
  }

  @RequirePermissions('delete:support')
  @Delete('ticket/:id')
  remove(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.supportService.remove(id, { id: authUser.id });
  }
}

@ApiTags('Support Public')
@Controller('/api/public/v1')
export class PublicSupportController {
  constructor(private readonly supportService: SupportService) {}

  @StrictThrottle()
  @Post('support')
  @ApiOperation({
    summary: 'Contact / support form',
    description: 'Creates a ticket, emails a confirmation, notifies admins.',
  })
  create(@Body() dto: CreateTicketDto, @ReqMeta() meta: { ip: string }) {
    return this.supportService.createPublic(dto, meta.ip);
  }
}
