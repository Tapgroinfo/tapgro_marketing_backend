import {
  Body,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { SettingsService } from '../settings/settings.service';
import { IntegrationLogService } from '../integrationLog/integrationLog.service';
import {
  SOCIAL_PROVIDERS,
  SocialProvider,
} from '../../utils/platform.constants';
import { SocialService } from './social.service';
import { LeadService } from '../lead/lead.service';

const SIGNATURE_HEADER: Record<SocialProvider, string> = {
  zernio: 'x-zernio-signature',
  ayrshare: 'x-webhook-signature',
};

@ApiTags('Webhooks Public')
@Controller('/api/public/v1')
export class WebhookController {
  constructor(
    private readonly integrationLogService: IntegrationLogService,
    private readonly settingsService: SettingsService,
    private readonly socialService: SocialService,
    private readonly leadService: LeadService,
  ) {}

  @Post('webhooks/:provider')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inbound webhook from the social provider',
    description:
      'Register https://<APP_BASE_URL>/api/public/v1/webhooks/zernio in the Zernio dashboard with the same secret as settings.socialProvider.webhookSecret. Zernio signs with X-Zernio-Signature (hex HMAC-SHA256 of the raw body). Handles account.connected / account.disconnected (channels) and lead.received (Meta lead forms → customer leads).',
  })
  async receive(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-zernio-event-id') zernioEventId: string | undefined,
    @Body() body: Record<string, any>,
  ) {
    if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) {
      throw new NotFoundException('Unknown webhook provider');
    }

    const config = await this.settingsService.getSocialProviderConfig();
    const secret =
      config.provider === provider ? config.webhookSecret || '' : '';
    const signature = req.headers[SIGNATURE_HEADER[provider as SocialProvider]];
    const signatureValid = secret
      ? this.verifySignature(
          secret,
          req.rawBody,
          signature as string | undefined,
        )
      : null;

    const event =
      typeof body?.event === 'string'
        ? body.event
        : typeof body?.type === 'string'
          ? body.type
          : '';
    const eventId =
      zernioEventId || (typeof body?.id === 'string' ? body.id : '');

    if (signatureValid === false) {
      await this.integrationLogService.log({
        type: 'webhook',
        provider,
        direction: 'inbound',
        event,
        status: 'failed',
        target: eventId || req.originalUrl,
        request: body,
        signatureValid,
        error: 'Invalid signature',
      });
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (
      eventId &&
      (await this.integrationLogService.hasWebhookEvent(provider, eventId))
    ) {
      return { received: true, duplicate: true };
    }

    let result: unknown = null;
    if (provider === 'zernio' && !body?.test) {
      if (event.startsWith('account.')) {
        result = await this.socialService.handleAccountEvent(event, body);
      } else if (event === 'lead.received') {
        result = await this.leadService.createFromZernio(body);
      }
    }

    await this.integrationLogService.log({
      type: 'webhook',
      provider,
      direction: 'inbound',
      event,
      status: 'received',
      target: eventId || req.originalUrl,
      request: body,
      response: result,
      signatureValid,
    });
    return { received: true };
  }

  private verifySignature(
    secret: string,
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): boolean {
    if (!rawBody || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const given = signature.replace(/^sha256=/i, '').trim();
    if (given.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  }
}
