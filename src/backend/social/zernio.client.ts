import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import Zernio, {
  RateLimitError,
  ValidationError,
  ZernioApiError,
} from '@zernio/node';
import { SettingsService } from '../settings/settings.service';
import { IntegrationLogService } from '../integrationLog/integrationLog.service';
import { ZERNIO_DEFAULT_API_BASE } from '../../utils/platform.constants';

export type ZernioAccount = {
  _id: string;
  platform: string;
  profileId: string | { _id: string };
  username?: string;
  displayName?: string;
  profilePicture?: string;
  isActive?: boolean;
};

export type ZernioAccountHealth = {
  accountId: string;
  platform: string;
  status: 'healthy' | 'warning' | 'error';
  canPost?: boolean;
  canFetchAnalytics?: boolean;
  needsReconnect?: boolean;
  issues?: string[];
};

export type ZernioPostPlatform = {
  platform: string;
  accountId: string | { _id: string };
  status: string;
  platformPostUrl?: string;
  errorMessage?: string;
};

export type ZernioPost = {
  _id: string;
  status: string;
  platforms: ZernioPostPlatform[];
};

const TIMEOUT_MS = 30_000;

/**
 * Nest wrapper around `@zernio/node`.
 * Public method shapes stay stable for SocialService; API key + logs come from TapGro settings.
 */
@Injectable()
export class ZernioClient {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly integrationLogService: IntegrationLogService,
  ) {}

  // ---------- profiles ----------

  async listProfiles() {
    return this.call<{ profiles?: Array<{ _id: string; name: string }> }>(
      'profile.list',
      false,
      (sdk) => sdk.profiles.listProfiles(),
    );
  }

  async createProfile(body: {
    name: string;
    description?: string;
    color?: string;
    timezone?: string;
    externalId: string;
  }) {
    return this.call<{ profile: { _id: string } }>(
      'profile.create',
      true,
      (sdk) => sdk.profiles.createProfile({ body }),
    );
  }

  async updateProfile(
    profileId: string,
    body: {
      name?: string;
      description?: string;
      color?: string;
      timezone?: string;
    },
  ) {
    return this.call('profile.update', true, (sdk) =>
      sdk.profiles.updateProfile({ path: { profileId }, body }),
    );
  }

  async deleteProfile(profileId: string) {
    return this.call('profile.delete', true, (sdk) =>
      sdk.profiles.deleteProfile({ path: { profileId } }),
    );
  }

  // ---------- accounts ----------

  async listAccounts(profileId?: string) {
    const res = await this.call<{ accounts?: ZernioAccount[] }>(
      'account.list',
      false,
      (sdk) =>
        sdk.accounts.listAccounts({
          query: profileId ? { profileId } : undefined,
        }),
    );
    return res.accounts || [];
  }

  async accountsHealth(profileId?: string) {
    const res = await this.call<{ accounts?: ZernioAccountHealth[] }>(
      'account.health',
      false,
      (sdk) =>
        sdk.accounts.getAllAccountsHealth({
          query: profileId ? { profileId } : undefined,
        }),
    );
    return (res.accounts || []) as ZernioAccountHealth[];
  }

  async disconnectAccount(accountId: string) {
    return this.call('account.disconnect', true, (sdk) =>
      sdk.accounts.deleteAccount({ path: { accountId } }),
    );
  }

  // ---------- connect ----------

  async getConnectUrl(
    platform: string,
    query: {
      profileId: string;
      redirect_url: string;
      brandName?: string;
      logoUrl?: string;
    },
  ) {
    const welcome = !!(query.brandName || query.logoUrl);
    return this.call<{ authUrl: string; state?: string }>(
      `connect.${platform}`,
      true,
      (sdk) =>
        sdk.connect.getConnectUrl({
          path: { platform: platform as 'instagram' },
          query: {
            profileId: query.profileId,
            redirect_url: query.redirect_url,
            brandName: query.brandName,
            logoUrl: query.logoUrl,
            welcome: welcome || undefined,
          },
        }),
    );
  }

  /** Meta ads: returns alreadyConnected when the Facebook account has ads scopes. */
  async getMetaAdsConnectUrl(query: {
    profileId: string;
    redirect_url: string;
  }) {
    return this.call<{
      authUrl?: string;
      alreadyConnected?: boolean;
      accountId?: string;
    }>('connect.metaads', true, (sdk) =>
      sdk.connect.connectAds({
        path: { platform: 'facebook' },
        query: {
          profileId: query.profileId,
          redirect_url: query.redirect_url,
        },
      }),
    );
  }

  // ---------- posts ----------

  async createPost(body: Record<string, unknown>) {
    return this.call<{ post: ZernioPost }>('post.create', true, (sdk) =>
      sdk.posts.createPost({ body: body as never }),
    );
  }

  /**
   * Raw SDK (settings API key). Prefer the methods above; use this for new
   * posts / comments / inbox endpoints during phase 3.
   */
  async getSdk(): Promise<Zernio> {
    return this.buildSdk();
  }

  // ---------- core ----------

  private async call<T>(
    event: string,
    log: boolean,
    run: (sdk: Zernio) => Promise<{ data?: unknown; error?: unknown } | unknown>,
  ): Promise<T> {
    const started = Date.now();
    const { sdk, apiKeyPresent } = await this.buildSdkWithMeta();
    const logBase = {
      type: 'api',
      provider: 'zernio',
      direction: 'outbound',
      event,
      target: event,
      request: null,
    } as const;

    if (!apiKeyPresent) {
      // buildSdk already throws BadRequest when missing; keep type narrow
      throw new BadRequestException('Zernio API key is missing');
    }

    try {
      const result = await run(sdk);
      const data = this.unwrapData<T>(result);
      if (log) {
        await this.integrationLogService.log({
          ...logBase,
          status: 'success',
          response: data,
          durationMs: Date.now() - started,
        });
      }
      return data;
    } catch (error) {
      const mapped = this.toHttpError(error);
      await this.integrationLogService.log({
        ...logBase,
        status: 'failed',
        statusCode: this.statusOf(mapped),
        response:
          error instanceof ZernioApiError ? (error.body ?? null) : null,
        error: mapped.message,
        durationMs: Date.now() - started,
      });
      throw mapped;
    }
  }

  private unwrapData<T>(result: unknown): T {
    if (result && typeof result === 'object' && 'data' in result) {
      return (result as { data: T }).data;
    }
    return result as T;
  }

  private async buildSdk(): Promise<Zernio> {
    const { sdk } = await this.buildSdkWithMeta();
    return sdk;
  }

  private async buildSdkWithMeta(): Promise<{
    sdk: Zernio;
    apiKeyPresent: boolean;
  }> {
    const config = await this.settingsService.getSocialProviderConfig();
    if (!config.enabled || (config.provider || 'zernio') !== 'zernio') {
      throw new BadRequestException(
        'Zernio is not enabled. Set socialProvider.enabled=true and provider=zernio in settings.',
      );
    }
    if (!config.apiKey) {
      throw new BadRequestException(
        'Zernio API key is missing. Add it in settings (socialProvider.apiKey).',
      );
    }

    const sdk = new Zernio({
      apiKey: config.apiKey,
      baseURL: this.normalizeBaseUrl(config.apiBaseUrl),
      timeout: TIMEOUT_MS,
    });
    return { sdk, apiKeyPresent: true };
  }

  /**
   * Settings historically store `…/api/v1`. The SDK uses `…/api` and prefixes `/v1` itself.
   */
  private normalizeBaseUrl(raw?: string | null): string {
    let base = (raw || ZERNIO_DEFAULT_API_BASE).replace(/\/$/, '');
    if (base.endsWith('/v1')) {
      base = base.slice(0, -3).replace(/\/$/, '');
    }
    return base || 'https://zernio.com/api';
  }

  private statusOf(error: HttpException): number {
    try {
      return error.getStatus();
    } catch {
      return 502;
    }
  }

  private toHttpError(error: unknown): HttpException {
    if (error instanceof HttpException) return error;

    if (error instanceof RateLimitError) {
      return new HttpException(
        {
          message: error.message,
          provider: 'zernio',
          providerStatus: error.statusCode,
          code: error.code || 'rate_limited',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (error instanceof ValidationError) {
      return new BadRequestException({
        message: error.message,
        provider: 'zernio',
        providerStatus: error.statusCode,
        code: error.code || 'validation_error',
        fields: error.fields,
      });
    }

    if (error instanceof ZernioApiError) {
      const status = error.statusCode || 502;
      const payload = {
        message: error.message,
        provider: 'zernio',
        providerStatus: status,
        code: error.code,
        ...(error.docUrl ? { dashboardUrl: error.docUrl } : {}),
      };
      if (error.isAuthError() || status === 401) {
        return new BadGatewayException({
          ...payload,
          message: 'Zernio rejected the API key. Check socialProvider.apiKey.',
        });
      }
      if (error.isPaymentRequired() || status === 402) {
        return new HttpException(payload, HttpStatus.PAYMENT_REQUIRED);
      }
      if (error.isNotFound() || status === 404) {
        return new HttpException(payload, HttpStatus.NOT_FOUND);
      }
      if (error.isRateLimited() || status === 429) {
        return new HttpException(payload, HttpStatus.TOO_MANY_REQUESTS);
      }
      if (status >= 400 && status < 500) {
        return new BadRequestException(payload);
      }
      return new BadGatewayException(payload);
    }

    const reason = error instanceof Error ? error.message : String(error);
    return new BadGatewayException(`Could not reach Zernio: ${reason}`);
  }
}
