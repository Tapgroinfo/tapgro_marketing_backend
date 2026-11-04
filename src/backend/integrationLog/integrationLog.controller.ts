import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import {
  INTEGRATION_LOG_STATUSES,
  INTEGRATION_LOG_TYPES,
} from '../../db/schemas/integrationLog.schema';
import { IntegrationLogService } from './integrationLog.service';

@ApiTags('Integration Logs')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class IntegrationLogController {
  constructor(private readonly integrationLogService: IntegrationLogService) {}

  @RequirePermissions('read:integration_log')
  @Get('integration-logs')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'type', required: false, enum: INTEGRATION_LOG_TYPES })
  @ApiQuery({ name: 'status', required: false, enum: INTEGRATION_LOG_STATUSES })
  @ApiQuery({ name: 'provider', required: false, type: String })
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: ['inbound', 'outbound'],
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('direction') direction?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.integrationLogService.findAll({
      limit,
      page,
      search,
      sort_attr,
      sort,
      type,
      status,
      provider,
      direction,
      startDate,
      endDate,
    });
    return {
      success: true,
      message: 'Integration logs retrieved successfully',
      ...result,
    };
  }

  @RequirePermissions('read:integration_log')
  @Get('integration-log/:id')
  async findOne(@Param('id') id: string) {
    return {
      success: true,
      data: await this.integrationLogService.findOne(id),
    };
  }
}
