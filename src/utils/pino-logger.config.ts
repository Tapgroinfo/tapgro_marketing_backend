import { IncomingMessage, ServerResponse } from 'http';
import { Params } from 'nestjs-pino';
import { multistream } from 'pino';
import { createWriteStream, mkdirSync } from 'fs';
import { dirname } from 'path';
import { resolveHttpLoggingConfig } from './http-logging.config';

function mapNestLogLevel(logLevel?: string): string {
  const level = (logLevel || 'log').trim().toLowerCase();
  const map: Record<string, string> = {
    error: 'error',
    warn: 'warn',
    log: 'info',
    debug: 'debug',
    verbose: 'trace',
  };
  return map[level] ?? 'info';
}

function shouldSkipPath(path: string, skipPaths: string[]): boolean {
  return skipPaths.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** NestJS + Pino config — JSON logs for Grafana/Loki; pretty print in local dev. */
export function buildPinoLoggerParams(
  env: NodeJS.ProcessEnv = process.env,
): Params {
  const httpConfig = resolveHttpLoggingConfig(env);
  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase();
  const level = mapNestLogLevel(env.LOG_LEVEL);
  const logFile = (env.LOG_FILE || '').trim();
  const usePretty =
    !logFile &&
    env.LOG_PRETTY !== 'false' &&
    nodeEnv !== 'production' &&
    nodeEnv !== 'staging';

  const pinoHttp: NonNullable<Params['pinoHttp']> = {
    level,
    base: {
      service: env.LOG_SERVICE_NAME || 'tapgro-marketing-backend',
      env: nodeEnv,
    },
    customProps: (req: IncomingMessage) => ({
      context: 'HTTP',
      requestId: (req as IncomingMessage & { id?: string }).id,
    }),
    serializers: {
      req(req: IncomingMessage & { id?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    autoLogging: httpConfig.enabled
      ? {
          ignore: (req: IncomingMessage) => {
            const path = req.url || '';
            return shouldSkipPath(path, httpConfig.skipPaths);
          },
        }
      : false,
    customLogLevel: (
      _req: IncomingMessage,
      res: ServerResponse & { responseTime?: number },
      err?: Error,
    ) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      if ((res.responseTime ?? 0) >= httpConfig.slowRequestMs) return 'warn';
      return 'info';
    },
    customSuccessMessage: (
      req: IncomingMessage,
      res: ServerResponse & { responseTime?: number },
    ) => {
      const ms = res.responseTime ?? 0;
      const slow =
        ms >= httpConfig.slowRequestMs ? ` SLOW ${ms}ms` : ` ${ms}ms`;
      return `${req.method} ${req.url} ${res.statusCode}${slow}`;
    },
    customErrorMessage: (req: IncomingMessage, res: ServerResponse) =>
      `${req.method} ${req.url} ${res.statusCode}`,
  };

  if (logFile) {
    mkdirSync(dirname(logFile), { recursive: true });
    pinoHttp.stream = multistream([
      { stream: process.stdout },
      { stream: createWriteStream(logFile, { flags: 'a' }) },
    ]);
  } else if (usePretty) {
    pinoHttp.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return { pinoHttp };
}
