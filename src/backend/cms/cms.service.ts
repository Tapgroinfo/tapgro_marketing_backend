import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, CmsPage, Faq } from '../../db/schemas/cms.schema';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination, Sort } from '../../utils/pagination';
import {
  CreateBannerDto,
  CreateFaqDto,
  CreatePageDto,
  UpdateBannerDto,
  UpdateFaqDto,
  UpdatePageDto,
} from './dto/cms.dto';

export type CmsKind = 'faq' | 'banner' | 'page';

type CmsFilter = Pagination & {
  isActive?: boolean;
  category?: string;
  position?: string;
};

const LABEL: Record<CmsKind, string> = {
  faq: 'FAQ',
  banner: 'Banner',
  page: 'Page',
};

@Injectable()
export class CmsService {
  constructor(
    @InjectModel(Faq.name) private readonly faqModel: Model<Faq>,
    @InjectModel(Banner.name) private readonly bannerModel: Model<Banner>,
    @InjectModel(CmsPage.name) private readonly pageModel: Model<CmsPage>,
    private readonly globalService: GlobalService,
  ) {}

  // ---------- admin ----------

  async create(
    kind: CmsKind,
    dto: CreateFaqDto | CreateBannerDto | CreatePageDto,
    user_id: string,
  ) {
    if (kind === 'page') {
      await this.assertSlugFree((dto as CreatePageDto).slug);
    }
    this.assertDateWindow(dto as CreateBannerDto);
    const doc = await this.model(kind).create(dto);
    await this.audit(user_id, auditAction.CREATE, kind, doc);
    return {
      success: true,
      message: `${LABEL[kind]} created successfully`,
      data: doc,
    };
  }

  async update(
    kind: CmsKind,
    id: string,
    dto: UpdateFaqDto | UpdateBannerDto | UpdatePageDto,
    user_id: string,
  ) {
    const doc = await this.findOne(kind, id);
    const slug = (dto as UpdatePageDto).slug;
    if (kind === 'page' && slug && slug !== (doc as CmsPage).slug) {
      await this.assertSlugFree(slug, id);
    }
    doc.set(dto);
    this.assertDateWindow(doc);
    await doc.save();
    await this.audit(user_id, auditAction.UPDATE, kind, doc);
    return {
      success: true,
      message: `${LABEL[kind]} updated successfully`,
      data: doc,
    };
  }

  async remove(kind: CmsKind, id: string, user_id: string) {
    const doc = await this.findOne(kind, id);
    await doc.deleteOne();
    await this.audit(user_id, auditAction.DELETE, kind, doc);
    return { success: true, message: `${LABEL[kind]} deleted successfully` };
  }

  async findOne(kind: CmsKind, id: string) {
    const doc = await this.model(kind).findById(id);
    if (!doc) {
      throw new NotFoundException(`${LABEL[kind]} not found`);
    }
    return doc;
  }

  async findAll(kind: CmsKind, filter: CmsFilter) {
    const query: Record<string, unknown> = {};
    if (filter.isActive !== undefined) {
      query[kind === 'page' ? 'isPublished' : 'isActive'] = filter.isActive;
    }
    if (kind === 'faq' && filter.category) query.category = filter.category;
    if (kind === 'banner' && filter.position) query.position = filter.position;
    if (filter.search) {
      const field = kind === 'faq' ? 'question' : 'title';
      query[field] = { $regex: filter.search, $options: 'i' };
    }
    return this.globalService.paginate({
      model: this.model(kind),
      query,
      pagination: {
        ...filter,
        sort_attr:
          filter.sort_attr || (kind === 'page' ? 'title' : 'sortOrder'),
        sort: filter.sort || Sort.ASC,
      },
      select: kind === 'page' ? '-contentHtml' : {},
    });
  }

  // ---------- public ----------

  async publicFaqs(category?: string) {
    const query: Record<string, unknown> = { isActive: true };
    if (category) query.category = category.toLowerCase();
    return this.faqModel
      .find(query)
      .select('question answer category sortOrder')
      .sort({ category: 1, sortOrder: 1 });
  }

  async publicBanners(position?: string) {
    const now = new Date();
    const query: Record<string, unknown> = {
      isActive: true,
      $and: [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
      ],
    };
    if (position) query.position = position.toLowerCase();
    return this.bannerModel
      .find(query)
      .select('title subtitle imageUrl linkUrl position sortOrder')
      .sort({ sortOrder: 1 });
  }

  async publicPage(slug: string) {
    const page = await this.pageModel
      .findOne({ slug: slug.toLowerCase(), isPublished: true })
      .select('title slug contentHtml metaTitle metaDescription');
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  // ---------- helpers ----------

  private model(kind: CmsKind): Model<any> {
    return {
      faq: this.faqModel,
      banner: this.bannerModel,
      page: this.pageModel,
    }[kind];
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const query: Record<string, unknown> = { slug: slug.toLowerCase() };
    if (exceptId) query._id = { $ne: exceptId };
    if (await this.pageModel.exists(query)) {
      throw new BadRequestException('Page slug already exists');
    }
  }

  private assertDateWindow(dto: {
    startAt?: string | Date | null;
    endAt?: string | Date | null;
  }) {
    if (
      dto?.startAt &&
      dto?.endAt &&
      new Date(dto.startAt).getTime() > new Date(dto.endAt).getTime()
    ) {
      throw new BadRequestException('startAt must be before endAt');
    }
  }

  private async audit(
    user_id: string,
    action: string,
    kind: CmsKind,
    data: unknown,
  ) {
    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action,
        description: `${action} ${LABEL[kind]}`,
        auditType: auditType.CMS_LOG,
      },
      data,
    );
  }
}
