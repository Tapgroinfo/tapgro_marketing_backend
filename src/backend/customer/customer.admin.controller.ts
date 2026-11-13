import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
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
import { Sort } from '../../utils/pagination';
import { CUSTOMER_STATUSES } from '../../db/schemas/customer.schema';
import { CustomerService } from './customer.service';
import {
  AdminUpdateCustomerDto,
  ImportTapgroMembersDto,
  UpdateCustomerStatusDto,
  UpdateCustomerTapgroDto,
} from './dto/customer-admin.dto';

@ApiTags('Customers')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class CustomerAdminController {
  constructor(private readonly customerService: CustomerService) {}

  @RequirePermissions('read:customer')
  @Get('customers')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'status', required: false, enum: CUSTOMER_STATUSES })
  @ApiQuery({ name: 'isTapgroUser', required: false, type: Boolean })
  async findAll(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('status') status?: string,
    @Query('isTapgroUser', new ParseBoolPipe({ optional: true }))
    isTapgroUser?: boolean,
  ) {
    const result = await this.customerService.findAll({
      limit,
      page,
      search,
      sort_attr,
      sort,
      status,
      isTapgroUser,
    });
    return { success: true, ...result };
  }

  @RequirePermissions('read:customer')
  @Get('customer/:id')
  @ApiOperation({ summary: 'Customer with channels and lead counts' })
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.customerService.findOne(id) };
  }

  @RequirePermissions('update:customer')
  @Put('customer/:id')
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateCustomerDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.customerService.update(id, dto, authUser.id);
  }

  @RequirePermissions('update:customer')
  @Patch('customer/:id/status')
  @ApiOperation({ summary: 'Block (logs out everywhere) or activate' })
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.customerService.setStatus(id, dto.status, authUser.id);
  }

  @RequirePermissions('update:customer')
  @Patch('customer/:id/tapgro')
  @ApiOperation({ summary: 'Mark / unmark as existing TapGro user' })
  setTapgro(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerTapgroDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.customerService.setTapgro(id, dto, authUser.id);
  }

  // ---------- TapGro member directory ----------

  @RequirePermissions('read:customer')
  @Get('tapgro-members')
  @PaginationDecorator()
  @ApiOperation({
    summary: 'Known TapGro Hub customers (mobile list)',
    description:
      'Customers whose mobile is in this list are flagged isTapgroUser automatically on login.',
  })
  async members(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
  ) {
    const result = await this.customerService.findMembers({
      limit,
      page,
      search,
    });
    return { success: true, ...result };
  }

  @RequirePermissions('update:customer')
  @Post('tapgro-members/import')
  @ApiOperation({
    summary: 'Add / update TapGro members (bulk)',
    description: 'Also flags existing customers with matching mobiles.',
  })
  importMembers(
    @Body() dto: ImportTapgroMembersDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.customerService.importMembers(dto, authUser.id);
  }

  @RequirePermissions('update:customer')
  @Delete('tapgro-member/:id')
  removeMember(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.customerService.removeMember(id, authUser.id);
  }
}
