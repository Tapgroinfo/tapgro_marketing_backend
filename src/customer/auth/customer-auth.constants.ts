export const OTP_EXPIRY_SECONDS = 300;
export const OTP_RESEND_SECONDS = 30;
export const OTP_MAX_SENDS_PER_HOUR = 5;
export const OTP_MAX_VERIFY_ATTEMPTS = 5;

export const DEFAULT_CUSTOMER_ACCESS_EXPIRES_IN = '7d';
export const DEFAULT_CUSTOMER_REFRESH_EXPIRES_IN = '60d';

export const CUSTOMER_JWT_STRATEGY = 'customerjwt';

export type CustomerJwtPayload = { id: string; v: number; typ: 'customer' };
