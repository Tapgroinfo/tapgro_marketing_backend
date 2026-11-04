import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Client IP (respects `trust proxy`) and user agent. */
export const ReqMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return {
      ip: req.ip || req.socket?.remoteAddress || '',
      userAgent: String(req.headers['user-agent'] || ''),
    };
  },
);
