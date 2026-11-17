import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { AuthAdmin } from '../admin/decorators/adminAuth.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import { CHANNEL_STATUSES } from '../../db/schemas/social.schema';
import { SocialService } from './social.service';
import {
  ConnectChannelDto,
  CreateSocialProfileDto,
  TestChannelDto,
  UpdateSocialProfileDto,
} from './dto/social.dto';

@ApiTags('Social Channels')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1/social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // ---------- provider ----------

  @RequirePermissions('read:channel')
  @Post('provider/test')
  @ApiOperation({
    summary: 'Test Zernio configuration',
    description:
      'Calls Zernio with the API key from settings. Also returns the callback and webhook URLs to register.',
  })
  testProvider() {
    return this.socialService.testProvider();
  }

  @RequirePermissions('read:channel')
  @Get('summary')
  async summary() {
    return { success: true, data: await this.socialService.channelSummary() };
  }

  @RequirePermissions('update:channel')
  @Post('sync')
  @ApiOperation({
    summary: 'Re-sync channels + health of every active profile',
  })
  syncAll() {
    return this.socialService.syncAll();
  }

  // ---------- profiles ----------

  @RequirePermissions('read:channel')
  @Get('profiles')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  async profiles(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
    @Query('customerId') customerId?: string,
  ) {
    const result = await this.socialService.findProfiles({
      limit,
      page,
      search,
      sort_attr,
      sort,
      isActive,
      customerId,
    });
    return { success: true, ...result };
  }

  @RequirePermissions('create:channel')
  @Post('profile')
  @ApiOperation({
    summary: 'Create a social profile (brand / salon)',
    description:
      'Same fields as Zernio “Create new profile”: name (required), description, color (#hex), timezone (IANA, e.g. Asia/Kolkata). Also creates the matching Zernio profile.',
  })
  createProfile(
    @Body() dto: CreateSocialProfileDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.socialService.createProfile(dto, authUser.id);
  }

  @RequirePermissions('read:channel')
  @Get('profile/:id')
  @ApiOperation({ summary: 'Profile with its channels' })
  async profile(@Param('id') id: string) {
    return { success: true, data: await this.socialService.getProfile(id) };
  }

  @RequirePermissions('update:channel')
  @Put('profile/:id')
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateSocialProfileDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.socialService.updateProfile(id, dto, authUser.id);
  }

  @RequirePermissions('delete:channel')
  @Delete('profile/:id')
  @ApiOperation({
    summary: 'Delete profile (all channels must be disconnected)',
  })
  deleteProfile(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.socialService.deleteProfile(id, authUser.id);
  }

  @RequirePermissions('update:channel')
  @Post('profile/:id/sync')
  @ApiOperation({
    summary: 'Re-sync this profile’s channels and health from Zernio',
  })
  async syncProfile(@Param('id') id: string) {
    return {
      success: true,
      message: 'Profile synced',
      data: await this.socialService.syncProfile(id),
    };
  }

  @RequirePermissions('create:channel')
  @Post('profile/:id/connect')
  @ApiOperation({
    summary: 'Start connecting a channel (also used to reconnect)',
    description:
      'Returns authUrl — open it in the browser (new tab / popup). After login the browser returns to the callback, then to settings.socialProvider.panelRedirectUrl. Poll GET /social/connect/{session} for the result.',
  })
  connect(
    @Param('id') id: string,
    @Body() dto: ConnectChannelDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.socialService.startConnect(id, dto.platform, {
      userId: authUser.id,
    });
  }

  @RequirePermissions('create:channel')
  @Post('customers/:customerId/ensure-profile')
  @ApiOperation({
    summary: 'Ensure customer has a Zernio social profile',
    description:
      'Manager panel helper. Creates a linked profile if the customer has none.',
  })
  ensureCustomerProfile(
    @Param('customerId') customerId: string,
    @AuthAdmin() authUser: any,
  ) {
    return this.socialService.ensureCustomerProfile(customerId, authUser.id);
  }

  @RequirePermissions('create:channel')
  @Post('customers/:customerId/connect')
  @ApiOperation({
    summary: 'Connect a platform for a customer (manager assist)',
    description:
      'Creates the customer social profile if missing, then returns authUrl. OAuth returns to panelRedirectUrl — open it in a new tab while helping the salon.',
  })
  connectForCustomer(
    @Param('customerId') customerId: string,
    @Body() dto: ConnectChannelDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.socialService.startConnectForCustomer(
      customerId,
      dto.platform,
      authUser.id,
    );
  }

  @RequirePermissions('read:channel')
  @Get('connect/:session')
  @ApiOperation({ summary: 'Connect status: pending | connected | failed' })
  async connectStatus(@Param('session') session: string) {
    return {
      success: true,
      data: await this.socialService.getConnectSession(session),
    };
  }

  // ---------- channels ----------

  @RequirePermissions('read:channel')
  @Get('channels')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'profileId', required: false, type: String })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: CHANNEL_STATUSES })
  async channels(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('profileId') profileId?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.socialService.findChannels({
      limit,
      page,
      search,
      sort_attr,
      sort,
      profileId,
      platform,
      status,
    });
    return { success: true, ...result };
  }

  @RequirePermissions('read:channel')
  @Get('channel/:id')
  async channel(@Param('id') id: string) {
    return { success: true, data: await this.socialService.getChannel(id) };
  }

  @RequirePermissions('update:channel')
  @Post('channel/:id/test')
  @ApiOperation({
    summary: 'Test a channel',
    description:
      'mode=health checks token & permissions (safe). mode=post publishes a REAL post (needs confirmPublish=true; Instagram needs mediaUrl, YouTube needs a video).',
  })
  test(
    @Param('id') id: string,
    @Body() dto: TestChannelDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.socialService.testChannel(id, dto, authUser.id);
  }

  @RequirePermissions('delete:channel')
  @Delete('channel/:id')
  @ApiOperation({ summary: 'Disconnect channel (stops Zernio billing for it)' })
  disconnect(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.socialService.disconnectChannel(id, authUser.id);
  }
}

@ApiTags('Social Public')
@Controller('/api/public/v1/social')
export class SocialPublicController {
  constructor(private readonly socialService: SocialService) {}

  /** Browser return URL after OAuth (redirect_url sent to Zernio). */
  @Get('connect/callback')
  @ApiExcludeEndpoint()
  async callback(
    @Res() res: Response,
    @Query('session') session?: string,
    @Query('accountId') accountId?: string,
    @Query('error') error?: string,
    @Query('error_message') error_message?: string,
  ) {
    const result = await this.socialService.completeConnect({
      session,
      accountId,
      error,
      error_message,
    });
    if (result.redirect) {
      return res.redirect(302, result.redirect);
    }
    const ok = result.status === 'success';
    const safe = result.message.replace(/[<>&"]/g, '');
    res
      .status(ok ? 200 : 400)
      .type('html')
      .send(
        `<!doctype html><meta charset="utf-8"><title>${ok ? 'Connected' : 'Not connected'}</title>` +
          `<body style="font-family:sans-serif;text-align:center;padding:48px">` +
          `<h2>${ok ? '✅ Channel connected' : '❌ Channel not connected'}</h2><p>${safe}</p>` +
          `<p>You can close this window.</p><script>setTimeout(()=>window.close(),2500)</script></body>`,
      );
  }
}
