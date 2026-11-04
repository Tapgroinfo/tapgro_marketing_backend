import { Throttle } from '@nestjs/throttler';

/** Global default: 300 requests / minute / IP. */
export const DEFAULT_THROTTLE = { ttl: 60_000, limit: 300 };

/** For login, password reset and public form submissions. */
export const StrictThrottle = () =>
  Throttle({ default: { ttl: 60_000, limit: 10 } });
