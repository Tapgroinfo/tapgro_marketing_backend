/** Never returned in API responses or audit details. */
export const SENSITIVE_ADMIN_FIELDS = [
  'password',
  'refresh_token',
  'refresh_token_expires_at',
  'tokenVersion',
  'failedLoginAttempts',
  'lockedUntil',
  'resetOtpHash',
  'resetOtpExpiresAt',
  'resetOtpSentAt',
  'resetOtpAttempts',
] as const;

export const SAFE_ADMIN_SELECT = SENSITIVE_ADMIN_FIELDS.map(
  (f) => `-${f}`,
).join(' ');

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export const RESET_OTP_EXPIRY_MINUTES = 10;
export const RESET_OTP_MAX_ATTEMPTS = 5;
export const RESET_OTP_RESEND_SECONDS = 60;

export type RequestMeta = { ip: string; userAgent: string };
