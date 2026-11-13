import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  SocialChannel,
  SocialChannelDocument,
  SocialConnectSession,
  SocialProfile,
  SocialProfileDocument,
} from '../../db/schemas/social.schema';
import { Platform } from '../../db/schemas/platform.schema';
import { GlobalService } from '../globalService/global.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationService } from '../notification/notification.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination } from '../../utils/pagination';
import {
  MEDIA_REQUIRED_PLATFORMS,
  SLUG_BY_ZERNIO_PLATFORM,
  ZERNIO_PLATFORM_BY_SLUG,
} from '../../utils/platform.constants';
import { ZernioAccountHealth, ZernioClient } from './zernio.client';
import {
  CreateSocialProfileDto,
  TestChannelDto,
  UpdateSocialProfileDto,
} from './dto/social.dto';

const CONNECT_SESSION_MINUTES = 30;

export type ChannelFilter = Pagination & {
  profileId?: string;
  platform?: string;
  status?: string;
};

export type SyncSummary = {
  total: number;
  added: number;
  updated: number;
  disconnected: number;
};

type CallbackQuery = {
  session?: string;
  accountId?: string;
  error?: string;
  error_message?: string;
};

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @InjectModel(SocialProfile.name)
    private readonly profileModel: Model<SocialProfile>,
    @InjectModel(SocialChannel.name)
    private readonly channelModel: Model<SocialChannel>,
    @InjectModel(SocialConnectSession.name)
    private readonly sessionModel: Model<SocialConnectSession>,
    @InjectModel(Platform.name) private readonly platformModel: Model<Platform>,
    private readonly zernio: ZernioClient,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
    private readonly globalService: GlobalService,
    private readonly notificationService: NotificationService,
  ) {}

  // ================= provider =================

  /** Validates the API key and returns what Zernio holds vs what we hold. */
  async testProvider() {
    const config = await this.settingsService.getSocialProviderConfig();
    const started = Date.now();
    const [{ profiles }, accounts] = await Promise.all([
      this.zernio.listProfiles(),
      this.zernio.listAccounts(),
    ]);
    const [localProfiles, localChannels] = await Promise.all([
      this.profileModel.countDocuments(),
      this.channelModel.countDocuments({ status: { $ne: 'disconnected' } }),
    ]);
    return {
      success: true,
      message: 'Zernio API key is valid',
      data: {
        provider: 'zernio',
        apiBaseUrl: config.apiBaseUrl || 'default',
        responseMs: Date.now() - started,
        webhookSecretSet: !!config.webhookSecret,
        callbackUrl: this.callbackUrlOrNull(),
        webhookUrl: this.webhookUrlOrNull(),
        zernio: { profiles: profiles?.length ?? 0, accounts: accounts.length },
        local: { profiles: localProfiles, channels: localChannels },
      },
    };
  }

  // ================= profiles =================

  async createProfile(
    dto: CreateSocialProfileDto,
    user_id: string | null,
    customerId?: string,
  ) {
    await this.assertProfileNameFree(dto.name);
    const id = new Types.ObjectId();
    const zernio = await this.zernio.createProfile({
      name: dto.name,
      description: dto.description,
      externalId: id.toString(),
    });

    const profile = await this.profileModel.create({
      _id: id,
      name: dto.name,
      description: dto.description || '',
      externalRef: dto.externalRef || '',
      provider: 'zernio',
      providerProfileId: zernio.profile._id,
      ...(customerId ? { customer: customerId } : {}),
    });
    await this.audit(
      user_id,
      auditAction.CREATE,
      `Social profile created: ${profile.name}`,
      profile,
    );
    return { success: true, message: 'Social profile created', data: profile };
  }

  /** The customer's own profile, created in Zernio on first use. */
  async getOrCreateCustomerProfile(customer: {
    id: string;
    name?: string;
    businessName?: string;
    mobile: string;
  }) {
    const existing = await this.profileModel.findOne({ customer: customer.id });
    if (existing) return existing;
    const label = customer.businessName || customer.name || 'Customer';
    const { data } = await this.createProfile(
      {
        name: `${label} · ${customer.mobile}`,
        description: 'Customer app profile',
        externalRef: `customer:${customer.id}`,
      },
      null,
      customer.id,
    );
    return data;
  }

  async findCustomerProfile(customerId: string) {
    return this.profileModel.findOne({ customer: customerId });
  }

  async findProfileChannels(
    profileId: Types.ObjectId,
    includeDisconnected = false,
  ) {
    const query: Record<string, unknown> = { profile: profileId };
    if (!includeDisconnected) query.status = { $ne: 'disconnected' };
    return this.channelModel
      .find(query)
      .select('-providerAccountId')
      .sort({ platform: 1, createdAt: 1 });
  }

  /** 404 unless the channel belongs to the given profile. */
  async assertChannelInProfile(channelId: string, profileId: Types.ObjectId) {
    const channel = await this.findChannelOrFail(channelId);
    if (!channel.profile.equals(profileId)) {
      throw new NotFoundException('Channel not found');
    }
    return channel;
  }

  async updateProfile(
    id: string,
    dto: UpdateSocialProfileDto,
    user_id: string,
  ) {
    const profile = await this.findProfileOrFail(id);
    if (dto.name && dto.name !== profile.name) {
      await this.assertProfileNameFree(dto.name, id);
    }
    if (dto.name !== undefined || dto.description !== undefined) {
      await this.zernio.updateProfile(profile.providerProfileId, {
        name: dto.name,
        description: dto.description,
      });
    }
    profile.set(dto);
    await profile.save();
    await this.audit(
      user_id,
      auditAction.UPDATE,
      `Social profile updated: ${profile.name}`,
      profile,
    );
    return { success: true, message: 'Social profile updated', data: profile };
  }

  async deleteProfile(id: string, user_id: string) {
    const profile = await this.findProfileOrFail(id);
    const live = await this.channelModel.countDocuments({
      profile: profile._id,
      status: { $ne: 'disconnected' },
    });
    if (live) {
      throw new BadRequestException(
        `Disconnect the ${live} connected channel(s) first`,
      );
    }
    try {
      await this.zernio.deleteProfile(profile.providerProfileId);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }
    await this.channelModel.deleteMany({ profile: profile._id });
    await profile.deleteOne();
    await this.audit(
      user_id,
      auditAction.DELETE,
      `Social profile deleted: ${profile.name}`,
      profile,
    );
    return { success: true, message: 'Social profile deleted' };
  }

  async findProfiles(filter: Pagination & { isActive?: boolean }) {
    const query: Record<string, unknown> = {};
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { externalRef: { $regex: filter.search, $options: 'i' } },
      ];
    }
    const result = await this.globalService.paginate<SocialProfileDocument>({
      model: this.profileModel,
      query,
      pagination: filter,
    });

    const ids = result.data.map((p) => p._id);
    const counts = await this.channelModel.aggregate<{
      _id: { profile: Types.ObjectId; status: string };
      count: number;
    }>([
      { $match: { profile: { $in: ids } } },
      {
        $group: {
          _id: { profile: '$profile', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);
    const data = result.data.map((p) => {
      const byStatus: Record<string, number> = {};
      for (const c of counts) {
        if (c._id.profile.equals(p._id)) byStatus[c._id.status] = c.count;
      }
      return { ...p.toJSON(), channels: byStatus };
    });
    return { ...result, data };
  }

  async getProfile(id: string) {
    const profile = await this.findProfileOrFail(id);
    const channels = await this.channelModel
      .find({ profile: profile._id })
      .sort({ status: 1, platform: 1 });
    return { ...profile.toJSON(), channelList: channels };
  }

  // ================= sync & health =================

  /** Pull accounts + health from Zernio and upsert our channel rows. */
  async syncProfile(
    profileOrId: SocialProfileDocument | string,
  ): Promise<SyncSummary> {
    const profile =
      typeof profileOrId === 'string'
        ? await this.findProfileOrFail(profileOrId)
        : profileOrId;

    const accounts = await this.zernio.listAccounts(profile.providerProfileId);
    let health: ZernioAccountHealth[] = [];
    try {
      health = await this.zernio.accountsHealth(profile.providerProfileId);
    } catch (error) {
      this.logger.warn(
        `Health fetch failed for ${profile.name}: ${String(error)}`,
      );
    }
    const healthById = new Map(health.map((h) => [h.accountId, h]));

    const summary: SyncSummary = {
      total: accounts.length,
      added: 0,
      updated: 0,
      disconnected: 0,
    };
    const seen: string[] = [];
    const now = new Date();

    for (const account of accounts) {
      seen.push(account._id);
      const h = healthById.get(account._id);
      const existing = await this.channelModel.findOne({
        providerAccountId: account._id,
      });
      const update = {
        profile: profile._id,
        platform: SLUG_BY_ZERNIO_PLATFORM[account.platform] || account.platform,
        providerPlatform: account.platform,
        username: account.username || '',
        displayName: account.displayName || '',
        avatarUrl: account.profilePicture || '',
        ...this.healthFields(h, account.isActive !== false),
        ...(h ? { lastHealthAt: now } : {}),
      };
      if (existing) {
        if (existing.status === 'disconnected') {
          Object.assign(update, {
            connectedAt: now,
            disconnectedAt: null,
            disconnectReason: '',
          });
        }
        existing.set(update);
        await existing.save();
        summary.updated++;
      } else {
        await this.channelModel.create({
          ...update,
          providerAccountId: account._id,
          connectedAt: now,
        });
        summary.added++;
      }
    }

    const gone = await this.channelModel.updateMany(
      {
        profile: profile._id,
        providerAccountId: { $nin: seen },
        status: { $ne: 'disconnected' },
      },
      {
        status: 'disconnected',
        canPost: false,
        disconnectedAt: now,
        disconnectReason: 'Not found in Zernio during sync',
      },
    );
    summary.disconnected = gone.modifiedCount;

    profile.lastSyncedAt = now;
    await profile.save();
    return summary;
  }

  async syncAll() {
    const profiles = await this.profileModel.find({ isActive: true });
    const results: Array<{
      profileId: string;
      name: string;
      ok: boolean;
      summary?: SyncSummary;
      error?: string;
    }> = [];
    for (const profile of profiles) {
      try {
        results.push({
          profileId: profile.id,
          name: profile.name,
          ok: true,
          summary: await this.syncProfile(profile),
        });
      } catch (error) {
        results.push({
          profileId: profile.id,
          name: profile.name,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return {
      success: results.every((r) => r.ok),
      message: `Synced ${results.filter((r) => r.ok).length}/${results.length} profile(s)`,
      data: results,
    };
  }

  // ================= connect flow =================

  async startConnect(
    profileId: string,
    platformSlug: string,
    actor: { userId?: string; customerId?: string },
  ) {
    const profile = await this.findProfileOrFail(profileId);
    if (!profile.isActive) {
      throw new BadRequestException('Profile is inactive');
    }
    const slug = platformSlug.toLowerCase().trim();
    const platform = await this.platformModel.findOne({
      slug,
      isDeleted: false,
    });
    if (!platform || !platform.isActive) {
      throw new BadRequestException(
        `Platform "${slug}" is not enabled. Activate it under Platforms first.`,
      );
    }
    const providerPlatform = ZERNIO_PLATFORM_BY_SLUG[slug];
    if (!providerPlatform) {
      throw new BadRequestException(
        `Platform "${slug}" is not supported by Zernio`,
      );
    }

    const state = randomBytes(24).toString('hex');
    const redirectUrl = `${this.requireCallbackUrl()}?session=${state}`;
    const config = await this.settingsService.getSocialProviderConfig();

    const session = await this.sessionModel.create({
      state,
      profile: profile._id,
      platform: slug,
      createdBy: actor.userId || null,
      customer: actor.customerId || null,
      expiresAt: new Date(Date.now() + CONNECT_SESSION_MINUTES * 60000),
    });

    if (slug === 'meta_ads') {
      const res = await this.zernio.getMetaAdsConnectUrl({
        profileId: profile.providerProfileId,
        redirect_url: redirectUrl,
      });
      if (res.alreadyConnected) {
        await this.syncProfile(profile);
        const channel = await this.channelModel.findOne({
          providerAccountId: res.accountId,
        });
        session.status = 'connected';
        session.message =
          'Meta Ads was already connected through the Facebook account';
        session.channel = channel?._id ?? null;
        await session.save();
        return {
          success: true,
          message: session.message,
          data: { alreadyConnected: true, session: state, channel },
        };
      }
      return this.connectResponse(state, res.authUrl!, session.expiresAt);
    }

    const res = await this.zernio.getConnectUrl(providerPlatform, {
      profileId: profile.providerProfileId,
      redirect_url: redirectUrl,
      brandName: config.brandName || undefined,
      logoUrl: config.logoUrl || undefined,
    });
    return this.connectResponse(state, res.authUrl, session.expiresAt);
  }

  /**
   * Browser lands here after OAuth. Query params are NOT trusted: we re-read the
   * profile's accounts from Zernio and only then mark the session.
   * Returns where to redirect the browser (or null to show a plain page).
   */
  async completeConnect(query: CallbackQuery) {
    const session = query.session
      ? await this.sessionModel.findOne({ state: query.session })
      : null;
    if (!session) {
      return this.callbackResult(
        null,
        'error',
        'Connect link is invalid or expired',
      );
    }
    if (session.status !== 'pending') {
      return this.callbackResult(
        session,
        session.status === 'connected' ? 'success' : 'error',
        session.message,
      );
    }
    if (session.expiresAt.getTime() < Date.now()) {
      session.status = 'failed';
      session.message = 'Connect link expired. Start again.';
      await session.save();
      return this.callbackResult(session, 'error', session.message);
    }

    if (query.error) {
      session.status = 'failed';
      session.message =
        query.error_message || this.describeConnectError(query.error);
      await session.save();
      return this.callbackResult(session, 'error', session.message);
    }

    try {
      await this.syncProfile(session.profile.toString());
    } catch (error) {
      session.status = 'failed';
      session.message = `Connected on the platform, but sync failed: ${error instanceof Error ? error.message : String(error)}`;
      await session.save();
      return this.callbackResult(session, 'error', session.message);
    }

    const channel = query.accountId
      ? await this.channelModel.findOne({
          providerAccountId: query.accountId,
          profile: session.profile,
        })
      : await this.channelModel
          .findOne({ profile: session.profile, platform: session.platform })
          .sort({ updatedAt: -1 });

    if (!channel) {
      session.status = 'failed';
      session.message =
        'The account was not found after connecting. Try again.';
      await session.save();
      return this.callbackResult(session, 'error', session.message);
    }

    session.status = 'connected';
    session.channel = channel._id;
    session.message = `${channel.displayName || channel.username || channel.platform} connected`;
    await session.save();
    if (session.createdBy) {
      await this.globalService.createAuditTrail(
        {
          updatedBy: session.createdBy.toString(),
          action: auditAction.CREATE,
          description: `Channel connected: ${channel.platform} (${channel.username || channel.displayName})`,
          auditType: auditType.SOCIAL_LOG,
        },
        channel,
      );
    }
    return this.callbackResult(session, 'success', session.message, channel.id);
  }

  async getConnectSession(state: string) {
    const session = await this.sessionModel
      .findOne({ state })
      .populate('channel');
    if (!session) {
      throw new NotFoundException('Connect session not found');
    }
    return session;
  }

  // ================= channels =================

  async findChannels(filter: ChannelFilter) {
    const query: Record<string, unknown> = {};
    if (filter.profileId) {
      if (!Types.ObjectId.isValid(filter.profileId)) {
        throw new BadRequestException('Invalid profileId');
      }
      query.profile = filter.profileId;
    }
    if (filter.platform) query.platform = filter.platform;
    if (filter.status) query.status = filter.status;
    if (filter.search) {
      query.$or = [
        { username: { $regex: filter.search, $options: 'i' } },
        { displayName: { $regex: filter.search, $options: 'i' } },
      ];
    }
    return this.globalService.paginate<SocialChannel>({
      model: this.channelModel,
      query,
      pagination: filter,
      populate: 'profile',
    });
  }

  async getChannel(id: string) {
    const channel = Types.ObjectId.isValid(id)
      ? await this.channelModel.findById(id).populate('profile')
      : null;
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    return channel;
  }

  async testChannel(id: string, dto: TestChannelDto, user_id: string | null) {
    const channel = await this.findChannelOrFail(id);
    const profile = await this.findProfileOrFail(channel.profile.toString());

    if (dto.mode === 'health') {
      const health = await this.zernio.accountsHealth(
        profile.providerProfileId,
      );
      const h = health.find((a) => a.accountId === channel.providerAccountId);
      if (!h) {
        await this.syncProfile(profile);
        const refreshed = await this.findChannelOrFail(id);
        return this.saveTest(refreshed, {
          mode: 'health',
          success: false,
          message:
            'Account not found in Zernio — it was removed or disconnected',
        });
      }
      channel.set({ ...this.healthFields(h, true), lastHealthAt: new Date() });
      const ok = h.status === 'healthy';
      return this.saveTest(channel, {
        mode: 'health',
        success: ok,
        message: ok
          ? 'Channel is healthy and can post'
          : (h.issues || []).join('; ') || `Health status: ${h.status}`,
      });
    }

    // mode === 'post'
    if (channel.status === 'disconnected') {
      throw new BadRequestException(
        'Channel is disconnected. Reconnect it first.',
      );
    }
    if (channel.platform === 'meta_ads') {
      throw new BadRequestException(
        'Meta Ads accounts cannot receive posts. Use mode=health.',
      );
    }
    const mediaRule = MEDIA_REQUIRED_PLATFORMS[channel.platform];
    if (mediaRule && !dto.mediaUrl) {
      throw new BadRequestException(
        `${channel.platform} needs ${mediaRule === 'video' ? 'a video' : 'an image or video'} — send mediaUrl`,
      );
    }
    if (mediaRule === 'video' && dto.mediaType !== 'video') {
      throw new BadRequestException(
        `${channel.platform} needs mediaType=video`,
      );
    }

    const { post } = await this.zernio.createPost({
      content: dto.content,
      publishNow: true,
      profileId: profile.providerProfileId,
      platforms: [
        {
          platform: channel.providerPlatform,
          accountId: channel.providerAccountId,
        },
      ],
      ...(dto.mediaUrl
        ? {
            mediaItems: [{ type: dto.mediaType || 'image', url: dto.mediaUrl }],
          }
        : {}),
    });
    const result = post.platforms?.[0];
    const ok = result?.status === 'published';
    await this.audit(
      user_id,
      auditAction.CREATE,
      `Test post on ${channel.platform} (${channel.username})`,
      {
        channel: channel.id,
        postId: post._id,
        status: post.status,
      },
    );
    return this.saveTest(channel, {
      mode: 'post',
      success: ok,
      message: ok
        ? 'Test post published'
        : result?.errorMessage ||
          `Post status: ${result?.status || post.status}`,
      postId: post._id,
      postUrl: result?.platformPostUrl || '',
    });
  }

  async disconnectChannel(
    id: string,
    user_id: string | null,
    reason = 'Disconnected by admin',
  ) {
    const channel = await this.findChannelOrFail(id);
    if (channel.status !== 'disconnected') {
      try {
        await this.zernio.disconnectAccount(channel.providerAccountId);
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
      }
    }
    channel.set({
      status: 'disconnected',
      canPost: false,
      disconnectedAt: new Date(),
      disconnectReason: reason,
    });
    await channel.save();
    await this.audit(
      user_id,
      auditAction.DELETE,
      `Channel disconnected: ${channel.platform} (${channel.username})`,
      channel,
    );
    return { success: true, message: 'Channel disconnected', data: channel };
  }

  async channelSummary() {
    const rows = await this.channelModel.aggregate<{
      _id: string;
      count: number;
    }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  // ================= webhooks =================

  /** account.connected / account.disconnected from Zernio. Never throws. */
  async handleAccountEvent(event: string, payload: Record<string, any>) {
    const account = payload?.account || {};
    const profile = account.profileId
      ? await this.profileModel.findOne({
          providerProfileId: account.profileId,
        })
      : null;
    if (!profile) return { handled: false, reason: 'Unknown profile' };

    try {
      await this.syncProfile(profile);
    } catch (error) {
      this.logger.error(`Webhook sync failed: ${String(error)}`);
    }

    if (
      event === 'account.disconnected' &&
      account.disconnectionType !== 'intentional'
    ) {
      const platform =
        SLUG_BY_ZERNIO_PLATFORM[account.platform] || account.platform;
      const channel = await this.channelModel.findOne({
        providerAccountId: account.accountId,
      });
      if (channel) {
        channel.set({
          status: 'needs_reconnect',
          canPost: false,
          disconnectReason: account.reason || 'Token expired or access removed',
        });
        await channel.save();
      }
      await this.notificationService.notifyAdmins(
        {
          title: `${platform} disconnected for ${profile.name}`,
          message: `${account.username || ''} — ${account.reason || 'Please reconnect the channel.'}`,
          type: 'warning',
          category: 'social',
          link: `/social/profiles/${profile.id}`,
        },
        'read:channel',
      );
    }
    return { handled: true };
  }

  // ================= helpers =================

  private healthFields(h: ZernioAccountHealth | undefined, isActive: boolean) {
    if (!h) {
      return isActive ? {} : { status: 'needs_reconnect', canPost: false };
    }
    const status =
      h.needsReconnect || h.status === 'error'
        ? 'needs_reconnect'
        : h.status === 'warning'
          ? 'warning'
          : 'connected';
    return {
      status,
      canPost: h.canPost ?? status !== 'needs_reconnect',
      canFetchAnalytics: h.canFetchAnalytics ?? true,
      issues: h.issues || [],
    };
  }

  private async saveTest(
    channel: SocialChannelDocument,
    result: {
      mode: string;
      success: boolean;
      message: string;
      postId?: string;
      postUrl?: string;
    },
  ) {
    channel.lastTest = {
      ...result,
      postId: result.postId || '',
      postUrl: result.postUrl || '',
      at: new Date(),
    };
    await channel.save();
    return {
      success: result.success,
      message: result.message,
      data: { channel, test: channel.lastTest },
    };
  }

  private connectResponse(state: string, authUrl: string, expiresAt: Date) {
    return {
      success: true,
      message: 'Open authUrl in the browser to connect the channel',
      data: { authUrl, session: state, expiresAt },
    };
  }

  private async callbackResult(
    session: SocialConnectSession | null,
    status: 'success' | 'error',
    message: string,
    channelId?: string,
  ) {
    const { panelRedirectUrl, customerRedirectUrl } =
      await this.settingsService.getSocialProviderConfig();
    const target = session?.customer ? customerRedirectUrl : panelRedirectUrl;
    let redirect: string | null = null;
    if (target) {
      const url = new URL(target);
      url.searchParams.set('social_connect', status);
      if (session) {
        url.searchParams.set('platform', session.platform);
        url.searchParams.set('session', session.state);
      }
      if (channelId) url.searchParams.set('channelId', channelId);
      url.searchParams.set('message', message);
      redirect = url.toString();
    }
    return { status, message, redirect };
  }

  private describeConnectError(code: string) {
    const known: Record<string, string> = {
      oauth_denied: 'Permission was denied on the platform.',
      no_facebook_pages:
        'No Facebook Page was selected or the user manages no Page.',
      connection_failed: 'The platform refused the connection. Try again.',
      invalid_state: 'The connect link expired. Start again.',
    };
    return known[code] || `Connection failed (${code})`;
  }

  private appBaseUrl() {
    return (this.configService.get<string>('APP_BASE_URL') || '')
      .trim()
      .replace(/\/$/, '');
  }

  private callbackUrlOrNull() {
    const base = this.appBaseUrl();
    return base ? `${base}/api/public/v1/social/connect/callback` : null;
  }

  private webhookUrlOrNull() {
    const base = this.appBaseUrl();
    return base ? `${base}/api/public/v1/webhooks/zernio` : null;
  }

  private requireCallbackUrl() {
    const url = this.callbackUrlOrNull();
    if (!url) {
      throw new BadRequestException(
        'APP_BASE_URL is not set — it is needed for the connect callback URL',
      );
    }
    return url;
  }

  private async assertProfileNameFree(name: string, exceptId?: string) {
    const query: Record<string, unknown> = {
      name: {
        $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        $options: 'i',
      },
    };
    if (exceptId) query._id = { $ne: exceptId };
    if (await this.profileModel.exists(query)) {
      throw new BadRequestException(
        'A social profile with this name already exists',
      );
    }
  }

  private async findProfileOrFail(id: string) {
    const profile = Types.ObjectId.isValid(id)
      ? await this.profileModel.findById(id)
      : null;
    if (!profile) {
      throw new NotFoundException('Social profile not found');
    }
    return profile;
  }

  private async findChannelOrFail(id: string) {
    const channel = Types.ObjectId.isValid(id)
      ? await this.channelModel.findById(id)
      : null;
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    return channel;
  }

  /** Admin actions only; customer-app actions pass null. */
  private async audit(
    user_id: string | null,
    action: string,
    description: string,
    data: unknown,
  ) {
    if (!user_id) return;
    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action,
        description,
        auditType: auditType.SOCIAL_LOG,
      },
      data,
    );
  }
}
