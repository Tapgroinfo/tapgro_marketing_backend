import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import { LEAD_SOURCES, LEAD_STATUSES } from '../../db/schemas/lead.schema';
import { LeadService } from './lead.service';

@ApiTags('Leads')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class LeadAdminController {
  constructor(private readonly leadService: LeadService) {}

  @RequirePermissions('read:lead')
  @Get('leads')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: LEAD_STATUSES })
  @ApiQuery({ name: 'source', required: false, enum: LEAD_SOURCES })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('platform') platform?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.leadService.findAll({
      limit,
      page,
      search,
      sort_attr,
      sort,
      customerId,
      status,
      source,
      platform,
      startDate,
      endDate,
    });
    return {
      success: true,
      summary: await this.leadService.summary(customerId),
      ...result,
    };
  }

  @RequirePermissions('read:lead')
  @Get('lead/:id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.leadService.findOne(id) };
  }
}
