import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CmsService } from './cms.service';

@ApiTags('CMS Public')
@Controller('/api/public/v1')
export class PublicCmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('faqs')
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiOperation({ summary: 'Active FAQs' })
  async faqs(@Query('category') category?: string) {
    return { success: true, data: await this.cmsService.publicFaqs(category) };
  }

  @Get('banners')
  @ApiQuery({ name: 'position', required: false, type: String })
  @ApiOperation({ summary: 'Active banners within their date window' })
  async banners(@Query('position') position?: string) {
    return {
      success: true,
      data: await this.cmsService.publicBanners(position),
    };
  }

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Published CMS page by slug' })
  async page(@Param('slug') slug: string) {
    return { success: true, data: await this.cmsService.publicPage(slug) };
  }
}
