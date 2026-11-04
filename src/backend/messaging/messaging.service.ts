import { Injectable } from '@nestjs/common';
import {
  MessageTemplate,
  TemplateChannel,
} from '../../db/schemas/messageTemplate.schema';
import { SettingsService } from '../settings/settings.service';
import { TemplateService } from '../template/template.service';
import { IntegrationLogService } from '../integrationLog/integrationLog.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { WhatsappService } from './whatsapp.service';
import { SendResult } from './messaging.types';

export type SendTemplateInput = {
  channel: TemplateChannel;
  slug: string;
  /** Email address or phone number. */
  to: string;
  variables?: Record<string, string | number>;
};

/** Sends stored templates over email / SMS / WhatsApp. Never throws. */
@Injectable()
export class MessagingService {
  constructor(
    private readonly templateService: TemplateService,
    private readonly settingsService: SettingsService,
    private readonly integrationLogService: IntegrationLogService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    const template = await this.templateService.findActive(
      input.channel,
      input.slug,
    );
    if (!template) {
      const reason = `No active ${input.channel} template "${input.slug}"`;
      await this.integrationLogService.log({
        type: input.channel,
        provider: 'template',
        direction: 'outbound',
        event: input.slug,
        status: 'skipped',
        target: input.to,
        error: reason,
      });
      return { sent: false, reason };
    }
    return this.sendWithTemplate(template, input.to, input.variables);
  }

  async sendWithTemplate(
    template: MessageTemplate,
    to: string,
    variables: Record<string, string | number> = {},
  ): Promise<SendResult> {
    const vars = {
      appName: await this.settingsService.getCompanyName(),
      ...variables,
    };
    const rendered = this.templateService.render(template, vars);
    const event = template.slug;

    switch (template.channel) {
      case 'email':
        return this.emailService.send({
          to,
          subject: rendered.subject,
          html: rendered.body,
          event,
        });
      case 'sms':
        return this.smsService.send({
          mobile: to,
          message: rendered.body,
          dltTemplateId: rendered.providerTemplateId,
          event,
        });
      case 'whatsapp':
        return this.whatsappService.send({
          phone: to,
          templateCode: rendered.providerTemplateId,
          data: Object.fromEntries(
            Object.entries(vars).map(([k, v]) => [k, String(v)]),
          ),
          event,
        });
      default:
        return { sent: false, reason: `Unknown channel ${template.channel}` };
    }
  }
}
