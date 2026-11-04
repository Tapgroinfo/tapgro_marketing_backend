import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MessageTemplate,
  TemplateChannel,
} from '../../db/schemas/messageTemplate.schema';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination } from '../../utils/pagination';
import { CreateTemplateDto } from './dto/createTemplate.dto';
import { UpdateTemplateDto } from './dto/updateTemplate.dto';

export type RenderedTemplate = {
  subject: string;
  body: string;
  providerTemplateId: string;
};

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(MessageTemplate.name)
    private readonly templateModel: Model<MessageTemplate>,
    private readonly globalService: GlobalService,
  ) {}

  async create(dto: CreateTemplateDto, user_id: string) {
    const exists = await this.templateModel.exists({
      channel: dto.channel,
      slug: dto.slug,
    });
    if (exists) {
      throw new BadRequestException(
        'A template with this slug already exists for this channel',
      );
    }
    const template = await this.templateModel.create({
      ...dto,
      variables: dto.variables ?? this.extractVariables(dto),
      isSystem: false,
    });
    await this.audit(user_id, auditAction.CREATE, 'Template created', template);
    return {
      success: true,
      message: 'Template created successfully',
      data: template,
    };
  }

  async update(id: string, dto: UpdateTemplateDto, user_id: string) {
    const template = await this.findOrFail(id);
    if (template.isSystem && dto.slug && dto.slug !== template.slug) {
      throw new BadRequestException('System template slug cannot be changed');
    }
    if (dto.slug && dto.slug !== template.slug) {
      const exists = await this.templateModel.exists({
        _id: { $ne: id },
        channel: template.channel,
        slug: dto.slug,
      });
      if (exists) {
        throw new BadRequestException(
          'A template with this slug already exists for this channel',
        );
      }
    }
    template.set(dto);
    if (!dto.variables && (dto.body || dto.subject)) {
      template.variables = this.extractVariables(template);
    }
    await template.save();
    await this.audit(user_id, auditAction.UPDATE, 'Template updated', template);
    return {
      success: true,
      message: 'Template updated successfully',
      data: template,
    };
  }

  async remove(id: string, user_id: string) {
    const template = await this.findOrFail(id);
    if (template.isSystem) {
      throw new BadRequestException(
        'System templates cannot be deleted; deactivate instead',
      );
    }
    await template.deleteOne();
    await this.audit(user_id, auditAction.DELETE, 'Template deleted', template);
    return { success: true, message: 'Template deleted successfully' };
  }

  async findAll(filter: Pagination & { channel?: string }) {
    const query: Record<string, unknown> = {};
    if (filter.channel) query.channel = filter.channel;
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { slug: { $regex: filter.search, $options: 'i' } },
      ];
    }
    return this.globalService.paginate<MessageTemplate>({
      model: this.templateModel,
      query,
      pagination: filter,
    });
  }

  async findOne(id: string) {
    return this.findOrFail(id);
  }

  async preview(id: string, variables: Record<string, string> = {}) {
    const template = await this.findOrFail(id);
    return this.render(template, variables);
  }

  /** Active template for a channel/slug, or null when missing / disabled. */
  async findActive(channel: TemplateChannel, slug: string) {
    return this.templateModel.findOne({ channel, slug, isActive: true });
  }

  render(
    template: Pick<
      MessageTemplate,
      'channel' | 'subject' | 'body' | 'providerTemplateId'
    >,
    variables: Record<string, string | number> = {},
  ): RenderedTemplate {
    const isEmail = template.channel === 'email';
    const fill = (text: string, escapeHtml: boolean) =>
      (text || '').replace(PLACEHOLDER, (_m, key: string) => {
        const value = variables[key];
        if (value === undefined || value === null) return '';
        const str = String(value);
        return escapeHtml
          ? this.escapeHtml(str).replace(/\r?\n/g, '<br/>')
          : str;
      });

    return {
      subject: fill(template.subject, false),
      body: fill(template.body, isEmail),
      providerTemplateId: template.providerTemplateId || '',
    };
  }

  private extractVariables(dto: { subject?: string; body?: string }) {
    const found = new Set<string>();
    for (const text of [dto.subject || '', dto.body || '']) {
      for (const match of text.matchAll(PLACEHOLDER)) found.add(match[1]);
    }
    return [...found];
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async findOrFail(id: string) {
    const template = await this.templateModel.findById(id);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  private async audit(
    user_id: string,
    action: string,
    description: string,
    template: MessageTemplate,
  ) {
    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action,
        description: `${description}: ${template.channel}/${template.slug}`,
        auditType: auditType.TEMPLATE_LOG,
      },
      template,
    );
  }
}
