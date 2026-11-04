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
import {
  SOCIAL_PROVIDERS,
  SocialProvider,
} from '../../utils/platform.constants';
import { IntegrationLogService } from './integrationLog.service';

@ApiTags('Webhooks Public')
@Controller('/api/public/v1')
export class WebhookController {
  constructor(
    private readonly integrationLogService: IntegrationLogService,
    private readonly settingsService: SettingsService,
  ) {}

  @Post('webhooks/:provider')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inbound webhook from the social provider (Zernio / Ayrshare)',
    description:
      'Logged to integration logs. When a webhook secret is set in settings, `x-webhook-signature` must be the hex HMAC-SHA256 of the raw body (optional `sha256=` prefix).',
  })
  async receive(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) {
      throw new NotFoundException('Unknown webhook provider');
    }

    const config = await this.settingsService.getSocialProviderConfig();
    const secret =
      config.provider === provider ? config.webhookSecret || '' : '';
    const signatureValid = secret
      ? this.verifySignature(secret, req.rawBody, signature)
      : null;

    const event =
      typeof body?.event === 'string'
        ? body.event
        : typeof body?.type === 'string'
          ? body.type
          : '';

    await this.integrationLogService.log({
      type: 'webhook',
      provider,
      direction: 'inbound',
      event,
      status: signatureValid === false ? 'failed' : 'received',
      target: req.originalUrl,
      request: body,
      signatureValid,
      error: signatureValid === false ? 'Invalid signature' : '',
    });

    if (signatureValid === false) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
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
