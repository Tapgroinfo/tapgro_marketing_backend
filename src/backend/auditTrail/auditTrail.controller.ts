import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import { auditType } from '../../utils/auditTypeEnum';
import { AuditTrailService } from './auditTrail.service';

@ApiTags('AuditTrail')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class AuditTrailController {
  constructor(private auditTrailService: AuditTrailService) {}

  @RequirePermissions('read:audit_trail')
  @Get('auditTrails')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'auditType', required: false, enum: auditType })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({
    name: 'updatedBy',
    required: false,
    type: String,
    description: 'Admin user ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start Date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End Date (YYYY-MM-DD)',
  })
  async getAuditTrails(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('auditType') auditType?: string,
    @Query('action') action?: string,
    @Query('updatedBy') updatedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.auditTrailService.findAllAuditTrails({
      page,
      limit,
      search,
      sort_attr,
      sort,
      auditType,
      action,
      updatedBy,
      startDate,
      endDate,
    });
    return {
      message: 'Audit trails retrieved successfully',
      ...result,
    };
  }
}
