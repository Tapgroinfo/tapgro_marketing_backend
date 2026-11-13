import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { IntegrationLogService } from '../integrationLog/integrationLog.service';
import { ZERNIO_DEFAULT_API_BASE } from '../../utils/platform.constants';

type Query = Record<string, string | number | boolean | undefined>;

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

/** Thin REST client for https://zernio.com/api/v1 (Bearer API key from settings). */
@Injectable()
export class ZernioClient {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly integrationLogService: IntegrationLogService,
  ) {}

  // ---------- profiles ----------

  listProfiles() {
    return this.request<{ profiles: Array<{ _id: string; name: string }> }>(
      'GET',
      '/profiles',
    );
  }

  createProfile(body: {
    name: string;
    description?: string;
    externalId: string;
  }) {
    return this.request<{ profile: { _id: string } }>('POST', '/profiles', {
      body,
      event: 'profile.create',
    });
  }

  updateProfile(
    profileId: string,
    body: { name?: string; description?: string },
  ) {
    return this.request('PUT', `/profiles/${encodeURIComponent(profileId)}`, {
      body,
      event: 'profile.update',
    });
  }

  deleteProfile(profileId: string) {
    return this.request(
      'DELETE',
      `/profiles/${encodeURIComponent(profileId)}`,
      {
        event: 'profile.delete',
      },
    );
  }

  // ---------- accounts ----------

  async listAccounts(profileId?: string) {
    const res = await this.request<{ accounts: ZernioAccount[] }>(
      'GET',
      '/accounts',
      { query: { profileId } },
    );
    return res.accounts || [];
  }

  async accountsHealth(profileId?: string) {
    const res = await this.request<{ accounts: ZernioAccountHealth[] }>(
      'GET',
      '/accounts/health',
      { query: { profileId } },
    );
    return res.accounts || [];
  }

  disconnectAccount(accountId: string) {
    return this.request(
      'DELETE',
      `/accounts/${encodeURIComponent(accountId)}`,
      {
        event: 'account.disconnect',
      },
    );
  }

  // ---------- connect ----------

  getConnectUrl(
    platform: string,
    query: {
      profileId: string;
      redirect_url: string;
      brandName?: string;
      logoUrl?: string;
    },
  ) {
    const welcome = !!(query.brandName || query.logoUrl);
    return this.request<{ authUrl: string; state?: string }>(
      'GET',
      `/connect/${encodeURIComponent(platform)}`,
      {
        query: { ...query, welcome: welcome || undefined },
        event: `connect.${platform}`,
        log: true,
      },
    );
  }

  /** Meta ads: returns alreadyConnected when the Facebook account has ads scopes. */
  getMetaAdsConnectUrl(query: { profileId: string; redirect_url: string }) {
    return this.request<{
      authUrl?: string;
      alreadyConnected?: boolean;
      accountId?: string;
    }>('GET', '/connect/facebook/ads', {
      query,
      event: 'connect.metaads',
      log: true,
    });
  }

  // ---------- posts ----------

  createPost(body: Record<string, unknown>) {
    return this.request<{ post: ZernioPost }>('POST', '/posts', {
      body,
      event: 'post.create',
    });
  }

  // ---------- core ----------

  /** Writes and failures are written to integration logs; successful reads are not. */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: {
      query?: Query;
      body?: unknown;
      event?: string;
      log?: boolean;
    } = {},
  ): Promise<T> {
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

    const base = (config.apiBaseUrl || ZERNIO_DEFAULT_API_BASE).replace(
      /\/$/,
      '',
    );
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(options.query || {})) {
      if (value !== undefined && value !== '')
        url.searchParams.set(key, String(value));
    }

    const logBase = {
      type: 'api',
      provider: 'zernio',
      direction: 'outbound',
      event: options.event || `${method} ${path}`,
      target: `${method} ${url.pathname}`,
      request: options.body ?? null,
    } as const;
    const shouldLog = options.log || method !== 'GET';

    const started = Date.now();
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.integrationLogService.log({
        ...logBase,
        status: 'failed',
        error: reason,
        durationMs: Date.now() - started,
      });
      throw new BadGatewayException(`Could not reach Zernio: ${reason}`);
    }

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 1000) };
    }

    if (!response.ok) {
      await this.integrationLogService.log({
        ...logBase,
        status: 'failed',
        statusCode: response.status,
        response: data,
        error: data?.error || `HTTP ${response.status}`,
        durationMs: Date.now() - started,
      });
      throw this.toHttpError(response.status, data);
    }

    if (shouldLog) {
      await this.integrationLogService.log({
        ...logBase,
        status: 'success',
        statusCode: response.status,
        response: data,
        durationMs: Date.now() - started,
      });
    }
    return data as T;
  }

  private toHttpError(status: number, data: any): HttpException {
    const message: string = data?.error || `Zernio returned HTTP ${status}`;
    const payload = {
      message,
      provider: 'zernio',
      providerStatus: status,
      code: data?.code,
      ...(data?.dashboard_url ? { dashboardUrl: data.dashboard_url } : {}),
    };
    if (status === 401) {
      return new BadGatewayException({
        ...payload,
        message: 'Zernio rejected the API key. Check socialProvider.apiKey.',
      });
    }
    if (status === 402) {
      return new HttpException(payload, HttpStatus.PAYMENT_REQUIRED);
    }
    if (status === 404) {
      return new HttpException(payload, HttpStatus.NOT_FOUND);
    }
    if (status === 429) {
      return new HttpException(payload, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (status >= 400 && status < 500) {
      return new BadRequestException(payload);
    }
    return new BadGatewayException(payload);
  }
}
