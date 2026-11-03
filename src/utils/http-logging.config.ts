import { LogLevel } from '@nestjs/common';

export type HttpLoggingConfig = {
  enabled: boolean;
  slowRequestMs: number;
  skipPaths: string[];
};

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

/** HTTP request logging — enabled by default in dev/staging; set HTTP_LOG_ENABLED=true on production. */
export function resolveHttpLoggingConfig(
  env: NodeJS.ProcessEnv = process.env,
): HttpLoggingConfig {
  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase();
  const explicit = parseBool(env.HTTP_LOG_ENABLED);
  const enabled =
    explicit !== undefined
      ? explicit
      : nodeEnv === 'development' ||
        nodeEnv === 'staging' ||
        nodeEnv === 'test';

  return {
    enabled,
    slowRequestMs: Math.max(0, Number(env.HTTP_LOG_SLOW_MS) || 2000),
    skipPaths: (env.HTTP_LOG_SKIP_PATHS || '/uploads,/sample-pdfs')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  };
}

export function resolveNestLoggerLevels(logLevel?: string): LogLevel[] {
  const level = (logLevel || 'log').trim().toLowerCase();
  const levels: Record<string, LogLevel[]> = {
    error: ['error'],
    warn: ['error', 'warn'],
    log: ['error', 'warn', 'log'],
    debug: ['error', 'warn', 'log', 'debug'],
    verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
  };
  return levels[level] ?? levels.log;
}
