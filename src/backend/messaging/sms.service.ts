import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { IntegrationLogService } from '../integrationLog/integrationLog.service';
import { SendResult } from './messaging.types';

const DEFAULT_SMS_ENDPOINT = 'https://api.smartping.ai/fe/api/v1/send';

export type SendSmsInput = {
  mobile: string;
  message: string;
  /** DLT content id of the approved template. */
  dltTemplateId: string;
  event?: string;
};

@Injectable()
export class SmsService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly integrationLogService: IntegrationLogService,
  ) {}

  async send(input: SendSmsInput): Promise<SendResult> {
    const sms = await this.settingsService.getSmsConfig();
    const endpoint = sms.endpoint || DEFAULT_SMS_ENDPOINT;
    const base = {
      type: 'sms',
      provider: 'sms_gateway',
      direction: 'outbound',
      event: input.event || '',
      target: input.mobile,
      request: { message: input.message, dltTemplateId: input.dltTemplateId },
    } as const;

    const missing = !sms.enabled
      ? 'SMS gateway is disabled'
      : !sms.username || !sms.password || !sms.senderId
        ? 'SMS credentials are incomplete'
        : !input.dltTemplateId
          ? 'Template has no DLT content id'
          : '';
    if (missing) {
      await this.integrationLogService.log({
        ...base,
        status: 'skipped',
        error: missing,
      });
      return { sent: false, reason: missing };
    }

    const params = new URLSearchParams({
      username: sms.username!,
      password: sms.password!,
      unicode: 'false',
      from: sms.senderId!,
      to: input.mobile,
      dltContentId: input.dltTemplateId,
      dltPrincipalEntityId: sms.dltPrincipalEntityId || '',
      dltTelemarketerId: sms.dltTelemarketerId || '',
      text: input.message,
    });

    const started = Date.now();
    try {
      const response = await fetch(`${endpoint}?${params.toString()}`);
      const text = await response.text();
      const ok = response.ok;
      await this.integrationLogService.log({
        ...base,
        status: ok ? 'success' : 'failed',
        statusCode: response.status,
        response: text.slice(0, 2000),
        error: ok ? '' : `HTTP ${response.status}`,
        durationMs: Date.now() - started,
      });
      return ok
        ? { sent: true }
        : { sent: false, reason: `HTTP ${response.status}` };
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
