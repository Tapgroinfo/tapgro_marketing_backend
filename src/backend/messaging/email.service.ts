import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';
import { IntegrationLogService } from '../integrationLog/integrationLog.service';
import { SendResult } from './messaging.types';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  /** Template slug or purpose, shown in integration logs. */
  event?: string;
};

@Injectable()
export class EmailService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly integrationLogService: IntegrationLogService,
  ) {}

  async send(input: SendEmailInput): Promise<SendResult> {
    const to = Array.isArray(input.to) ? input.to.join(', ') : input.to;
    const base = {
      type: 'email',
      provider: 'smtp',
      direction: 'outbound',
      event: input.event || '',
      target: to,
      request: { subject: input.subject },
    } as const;

    const smtp = await this.settingsService.getEmailSmtpConfig();
    if (!smtp.enabled || !smtp.host || !smtp.fromEmail) {
      const reason = 'SMTP is disabled or host / from email is missing';
      await this.integrationLogService.log({
        ...base,
        status: 'skipped',
        error: reason,
      });
      return { sent: false, reason };
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth:
        smtp.username || smtp.password
          ? { user: smtp.username, pass: smtp.password }
          : undefined,
    });

    const started = Date.now();
    try {
      const info = await transporter.sendMail({
        from: smtp.fromName
          ? `"${smtp.fromName}" <${smtp.fromEmail}>`
          : smtp.fromEmail,
        to,
        subject: input.subject,
        html: input.html,
      });
      await this.integrationLogService.log({
        ...base,
        status: 'success',
        response: { messageId: info.messageId },
        durationMs: Date.now() - started,
      });
      return { sent: true };
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
