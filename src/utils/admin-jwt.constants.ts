/** Default Command Center access token lifetime (JWT). */
export const DEFAULT_ADMIN_JWT_EXPIRES_IN = '3h';

/** Default refresh-token session lifetime stored on admin user. */
export const DEFAULT_ADMIN_REFRESH_EXPIRES_IN = '7d';

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parse duration strings like 3h, 2h, 7d into milliseconds. */
export function parseDurationToMs(value: string): number {
  const trimmed = String(value || '').trim();
  const match = /^(\d+(?:\.\d+)?)(s|m|h|d)$/i.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid duration "${value}". Use e.g. 3h, 2h, 7d.`);
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return Math.round(amount * UNIT_MS[unit]);
}

export function resolveAdminAccessExpiresIn(
  configured?: string | null,
): string {
  const value = configured?.trim();
  return value || DEFAULT_ADMIN_JWT_EXPIRES_IN;
}

export function resolveAdminRefreshExpiresIn(
  configured?: string | null,
): string {
  const value = configured?.trim();
  return value || DEFAULT_ADMIN_REFRESH_EXPIRES_IN;
}
