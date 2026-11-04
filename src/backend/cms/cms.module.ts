import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Banner,
  BannerSchema,
  CmsPage,
  CmsPageSchema,
  Faq,
  FaqSchema,
} from '../../db/schemas/cms.schema';
import { CmsController } from './cms.controller';
import { PublicCmsController } from './public-cms.controller';
import { CmsService } from './cms.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Faq.name, schema: FaqSchema },
      { name: Banner.name, schema: BannerSchema },
      { name: CmsPage.name, schema: CmsPageSchema },
    ]),
  ],
  controllers: [CmsController, PublicCmsController],
  providers: [CmsService],
})
export class CmsModule {}
