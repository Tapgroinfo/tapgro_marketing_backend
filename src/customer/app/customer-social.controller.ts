import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseBoolPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Model } from 'mongoose';
import type { CustomerDocument } from '../../db/schemas/customer.schema';
import { Platform } from '../../db/schemas/platform.schema';
import { SocialService } from '../../backend/social/social.service';
import {
  ConnectChannelDto,
  TestChannelDto,
} from '../../backend/social/dto/social.dto';
import { CurrentCustomer, CustomerJwtGuard } from '../auth/customer-auth.guard';

@ApiTags('Customer Social Channels')
@ApiBearerAuth('customerBearerAuth')
@UseGuards(CustomerJwtGuard)
@Controller('/api/customer/v1')
export class CustomerSocialController {
  constructor(
    private readonly socialService: SocialService,
    @InjectModel(Platform.name) private readonly platformModel: Model<Platform>,
  ) {}

  @Get('platforms')
  @ApiOperation({
    summary: 'Active platforms + my connection on each',
    description:
      'Only platforms an admin enabled. `connected` lists my channels on that platform; `canConnect` is false when one is already connected and healthy.',
  })
  async platforms(@CurrentCustomer() customer: CustomerDocument) {
    const [platforms, profile] = await Promise.all([
      this.platformModel
        .find({ isActive: true, isDeleted: false })
        .select('name slug description iconUrl capabilities sortOrder')
        .sort({ sortOrder: 1, name: 1 }),
      this.socialService.findCustomerProfile(customer.id),
    ]);
    const channels = profile
      ? await this.socialService.findProfileChannels(profile._id)
      : [];

    return {
      success: true,
      data: platforms.map((p) => {
        const mine = channels.filter((c) => c.platform === p.slug);
        return {
          ...p.toJSON(),
          connected: mine.map((c) => ({
            id: c.id,
            username: c.username,
            displayName: c.displayName,
            avatarUrl: c.avatarUrl,
            status: c.status,
          })),
          needsReconnect: mine.some((c) => c.status === 'needs_reconnect'),
        };
      }),
    };
  }

  @Get('channels')
  @ApiQuery({ name: 'includeDisconnected', required: false, type: Boolean })
  async channels(
    @CurrentCustomer() customer: CustomerDocument,
    @Query('includeDisconnected', new ParseBoolPipe({ optional: true }))
    includeDisconnected?: boolean,
  ) {
    const profile = await this.socialService.findCustomerProfile(customer.id);
    return {
      success: true,
      data: profile
        ? await this.socialService.findProfileChannels(
            profile._id,
            includeDisconnected,
          )
        : [],
    };
  }

  @Post('channels/connect')
  @ApiOperation({
    summary: 'Connect (or reconnect) a platform',
    description:
      'Returns authUrl — open it in an in-app browser / new tab. The user logs in to Facebook / Google / Instagram and picks the Page or location. The browser then returns to settings.socialProvider.customerRedirectUrl (?social_connect=success|error&channelId=…). Poll GET /channels/connect/{session} if needed.',
  })
  async connect(
    @CurrentCustomer() customer: CustomerDocument,
    @Body() dto: ConnectChannelDto,
  ) {
    const profile = await this.socialService.getOrCreateCustomerProfile({
      id: customer.id,
      name: customer.name,
      businessName: customer.businessName,
      mobile: customer.mobile,
    });
    return this.socialService.startConnect(profile.id, dto.platform, {
      customerId: customer.id,
    });
  }

  @Get('channels/connect/:session')
  @ApiOperation({ summary: 'Connect status: pending | connected | failed' })
  async connectStatus(
    @CurrentCustomer() customer: CustomerDocument,
    @Param('session') session: string,
  ) {
    const data = await this.socialService.getConnectSession(session);
    if (!data.customer?.equals(customer._id)) {
      throw new NotFoundException('Connect session not found');
    }
    return {
      success: true,
      data: {
        status: data.status,
        platform: data.platform,
        message: data.message,
        channel: data.channel,
        expiresAt: data.expiresAt,
      },
    };
  }

  @Post('channels/sync')
  @ApiOperation({ summary: 'Refresh my channels and their health' })
  async sync(@CurrentCustomer() customer: CustomerDocument) {
    const profile = await this.socialService.findCustomerProfile(customer.id);
    if (!profile) {
      return {
        success: true,
        message: 'No channels connected yet',
        data: null,
      };
    }
    return {
      success: true,
      message: 'Channels refreshed',
      data: await this.socialService.syncProfile(profile),
    };
  }

  @Post('channels/:id/test')
  @ApiOperation({
    summary: 'Test my channel',
    description:
      'mode=health is safe. mode=post publishes a REAL post (confirmPublish=true; Instagram needs mediaUrl).',
  })
  async test(
    @CurrentCustomer() customer: CustomerDocument,
    @Param('id') id: string,
    @Body() dto: TestChannelDto,
  ) {
    await this.assertMine(customer, id);
    return this.socialService.testChannel(id, dto, null);
  }

  @Delete('channels/:id')
  @ApiOperation({ summary: 'Disconnect my channel' })
  async disconnect(
    @CurrentCustomer() customer: CustomerDocument,
    @Param('id') id: string,
  ) {
    await this.assertMine(customer, id);
    return this.socialService.disconnectChannel(
      id,
      null,
      'Disconnected by customer',
    );
  }

  private async assertMine(customer: CustomerDocument, channelId: string) {
    const profile = await this.socialService.findCustomerProfile(customer.id);
    if (!profile) throw new NotFoundException('Channel not found');
    return this.socialService.assertChannelInProfile(channelId, profile._id);
  }
}
