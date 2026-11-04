import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
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
import { PlanService } from './plan.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@ApiTags('Plans')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @RequirePermissions('read:plan')
  @Get('plans')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ) {
    const result = await this.planService.findAll({
      limit,
      page,
      search,
      sort_attr,
      sort,
      isActive,
    });
    return {
      success: true,
      message: 'Plans retrieved successfully',
      ...result,
    };
  }

  @RequirePermissions('read:plan')
  @Get('plan/:id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.planService.findOne(id) };
  }

  @RequirePermissions('create:plan')
  @Post('plan')
  @ApiOperation({ summary: 'Create subscription plan' })
  create(@Body() dto: CreatePlanDto, @AuthAdmin() authUser: any) {
    return this.planService.create(dto, authUser.id);
  }

  @RequirePermissions('update:plan')
  @Put('plan/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.planService.update(id, dto, authUser.id);
  }

  @RequirePermissions('delete:plan')
  @Delete('plan/:id')
  remove(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.planService.remove(id, authUser.id);
  }
}

@ApiTags('Plans Public')
@Controller('/api/public/v1')
export class PublicPlanController {
  constructor(private readonly planService: PlanService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Active public plans (pricing page)' })
  async findPublic() {
    return { success: true, data: await this.planService.findPublic() };
  }
}
