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
import type { CustomerDocument } from '../../db/schemas/customer.schema';
import { LEAD_SOURCES, LEAD_STATUSES } from '../../db/schemas/lead.schema';
import { LeadService } from '../../backend/lead/lead.service';
import {
  AddLeadNoteDto,
  CreateLeadDto,
  UpdateLeadDto,
} from '../../backend/lead/dto/lead.dto';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import { CurrentCustomer, CustomerJwtGuard } from '../auth/customer-auth.guard';

@ApiTags('Customer Leads')
@ApiBearerAuth('customerBearerAuth')
@UseGuards(CustomerJwtGuard)
@Controller('/api/customer/v1/leads')
export class CustomerLeadController {
  constructor(private readonly leadService: LeadService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Counts by status and source, last 30 days' })
  async summary(@CurrentCustomer() customer: CustomerDocument) {
    return { success: true, data: await this.leadService.summary(customer.id) };
  }

  @Get()
  @PaginationDecorator()
  @ApiOperation({
    summary: 'My leads',
    description:
      'Meta lead-ad leads arrive automatically (source=meta_lead_ad) from my connected Facebook Page.',
  })
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'status', required: false, enum: LEAD_STATUSES })
  @ApiQuery({ name: 'source', required: false, enum: LEAD_SOURCES })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @CurrentCustomer() customer: CustomerDocument,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('platform') platform?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.leadService.findAll({
      customerId: customer.id,
      limit,
      page,
      search,
      sort_attr,
      sort,
      status,
      source,
      platform,
      startDate,
      endDate,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  async findOne(
    @CurrentCustomer() customer: CustomerDocument,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      data: await this.leadService.findOne(id, customer.id),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add a lead manually (walk-in, call, DM…)' })
  create(
    @CurrentCustomer() customer: CustomerDocument,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadService.create(customer.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update status, follow-up date or details' })
  update(
    @CurrentCustomer() customer: CustomerDocument,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadService.update(customer.id, id, dto);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a note (moves new → contacted)' })
  addNote(
    @CurrentCustomer() customer: CustomerDocument,
    @Param('id') id: string,
    @Body() dto: AddLeadNoteDto,
  ) {
    return this.leadService.addNote(customer.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentCustomer() customer: CustomerDocument,
    @Param('id') id: string,
  ) {
    return this.leadService.remove(customer.id, id);
  }
}
