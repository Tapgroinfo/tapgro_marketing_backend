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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { AuthAdmin } from '../admin/decorators/adminAuth.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import { CmsService } from './cms.service';
import {
  CreateBannerDto,
  CreateFaqDto,
  CreatePageDto,
  UpdateBannerDto,
  UpdateFaqDto,
  UpdatePageDto,
} from './dto/cms.dto';

@ApiTags('CMS')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1/cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  // ---------- FAQ ----------

  @RequirePermissions('read:cms')
  @Get('faqs')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'category', required: false, type: String })
  async faqs(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
    @Query('category') category?: string,
  ) {
    const result = await this.cmsService.findAll('faq', {
      limit,
      page,
      search,
      sort_attr,
      sort,
      isActive,
      category,
    });
    return { success: true, ...result };
  }

  @RequirePermissions('read:cms')
  @Get('faq/:id')
  async faq(@Param('id') id: string) {
    return { success: true, data: await this.cmsService.findOne('faq', id) };
  }

  @RequirePermissions('create:cms')
  @Post('faq')
  createFaq(@Body() dto: CreateFaqDto, @AuthAdmin() authUser: any) {
    return this.cmsService.create('faq', dto, authUser.id);
  }

  @RequirePermissions('update:cms')
  @Put('faq/:id')
  updateFaq(
    @Param('id') id: string,
    @Body() dto: UpdateFaqDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.cmsService.update('faq', id, dto, authUser.id);
  }

  @RequirePermissions('delete:cms')
  @Delete('faq/:id')
  removeFaq(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.cmsService.remove('faq', id, authUser.id);
  }

  // ---------- Banner ----------

  @RequirePermissions('read:cms')
  @Get('banners')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'position', required: false, type: String })
  async banners(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
    @Query('position') position?: string,
  ) {
    const result = await this.cmsService.findAll('banner', {
      limit,
      page,
      search,
      sort_attr,
      sort,
      isActive,
      position,
    });
    return { success: true, ...result };
  }

  @RequirePermissions('read:cms')
  @Get('banner/:id')
  async banner(@Param('id') id: string) {
    return {
      success: true,
      data: await this.cmsService.findOne('banner', id),
    };
  }

  @RequirePermissions('create:cms')
  @Post('banner')
  createBanner(@Body() dto: CreateBannerDto, @AuthAdmin() authUser: any) {
    return this.cmsService.create('banner', dto, authUser.id);
  }

  @RequirePermissions('update:cms')
  @Put('banner/:id')
  updateBanner(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.cmsService.update('banner', id, dto, authUser.id);
  }

  @RequirePermissions('delete:cms')
  @Delete('banner/:id')
  removeBanner(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.cmsService.remove('banner', id, authUser.id);
  }

  // ---------- Page ----------

  @RequirePermissions('read:cms')
  @Get('pages')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filters by isPublished',
  })
  async pages(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ) {
    const result = await this.cmsService.findAll('page', {
      limit,
      page,
      search,
      sort_attr,
      sort,
      isActive,
    });
    return { success: true, ...result };
  }

  @RequirePermissions('read:cms')
  @Get('page/:id')
  async pageById(@Param('id') id: string) {
    return { success: true, data: await this.cmsService.findOne('page', id) };
  }

  @RequirePermissions('create:cms')
  @Post('page')
  createPage(@Body() dto: CreatePageDto, @AuthAdmin() authUser: any) {
    return this.cmsService.create('page', dto, authUser.id);
  }

  @RequirePermissions('update:cms')
  @Put('page/:id')
  updatePage(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.cmsService.update('page', id, dto, authUser.id);
  }

  @RequirePermissions('delete:cms')
  @Delete('page/:id')
  removePage(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.cmsService.remove('page', id, authUser.id);
  }
}
