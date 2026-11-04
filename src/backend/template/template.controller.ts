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
import { Sort } from '../../utils/pagination';
import { TEMPLATE_CHANNELS } from '../../db/schemas/messageTemplate.schema';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/createTemplate.dto';
import {
  PreviewTemplateDto,
  UpdateTemplateDto,
} from './dto/updateTemplate.dto';

@ApiTags('Message Templates')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @RequirePermissions('create:template')
  @Post('template')
  @ApiOperation({ summary: 'Create email / SMS / WhatsApp template' })
  create(@Body() dto: CreateTemplateDto, @AuthAdmin() authUser: any) {
    return this.templateService.create(dto, authUser.id);
  }

  @RequirePermissions('update:template')
  @Put('template/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.templateService.update(id, dto, authUser.id);
  }

  @RequirePermissions('read:template')
  @Get('templates')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'channel', required: false, enum: TEMPLATE_CHANNELS })
  async findAll(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('channel') channel?: string,
  ) {
    const result = await this.templateService.findAll({
      limit,
      page,
      search,
      sort_attr,
      sort,
      channel,
    });
    return {
      success: true,
      message: 'Templates retrieved successfully',
      ...result,
    };
  }

  @RequirePermissions('read:template')
  @Get('template/:id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.templateService.findOne(id) };
  }

  @RequirePermissions('read:template')
  @Post('template/:id/preview')
  @ApiOperation({ summary: 'Render template with sample variables' })
  async preview(@Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return {
      success: true,
      data: await this.templateService.preview(id, dto.variables),
    };
  }

  @RequirePermissions('delete:template')
  @Delete('template/:id')
  remove(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.templateService.remove(id, authUser.id);
  }
}
