import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { IntegrationLogService } from '../integrationLog/integrationLog.service';
import { SendResult } from './messaging.types';

const DEFAULT_WHATSAPP_ENDPOINT =
  'https://tapgro.mehery.io/xms/api/v1/message/send';

export type SendWhatsappInput = {
  phone: string;
  templateCode: string;
  data: Record<string, string>;
  imageLink?: string;
  event?: string;
};

@Injectable()
export class WhatsappService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly integrationLogService: IntegrationLogService,
  ) {}

  async send(input: SendWhatsappInput): Promise<SendResult> {
    const config = await this.settingsService.getWhatsappConfig();
    const endpoint = config.endpoint || DEFAULT_WHATSAPP_ENDPOINT;

    const payload: Record<string, unknown> = {
      type: 'TEMPLATE',
      channelId: config.channelId,
      to: { phone: input.phone },
      template: { code: input.templateCode, data: input.data },
    };
    if (config.apiId) payload.apiId = config.apiId;
    if (input.imageLink) payload.image = { link: input.imageLink };

    const base = {
      type: 'whatsapp',
      provider: 'whatsapp_gateway',
      direction: 'outbound',
      event: input.event || '',
      target: input.phone,
      request: payload,
    } as const;

    const missing = !config.enabled
      ? 'WhatsApp gateway is disabled'
      : !config.apiKey || !config.channelId
        ? 'WhatsApp credentials are incomplete'
        : !input.templateCode
          ? 'Template has no provider template code'
          : '';
    if (missing) {
      await this.integrationLogService.log({
        ...base,
        status: 'skipped',
        error: missing,
      });
      return { sent: false, reason: missing };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey!,
    };
    if (config.apiId) headers['x-api-id'] = config.apiId;

    const started = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as {
        status?: string;
      } | null;
      const ok = data?.status === 'success';
      await this.integrationLogService.log({
        ...base,
        status: ok ? 'success' : 'failed',
        statusCode: response.status,
        response: data,
        error: ok ? '' : 'Provider did not return success',
        durationMs: Date.now() - started,
      });
      return ok
        ? { sent: true }
        : { sent: false, reason: 'Provider did not return success' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.integrationLogService.log({
        ...base,
        status: 'failed',
        error: reason,
        durationMs: Date.now() - started,
      });
      return { sent: false, reason };
    }
  }
}
