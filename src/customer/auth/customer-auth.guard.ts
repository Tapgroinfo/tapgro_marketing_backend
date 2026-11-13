import {
  createParamDecorator,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CUSTOMER_JWT_STRATEGY } from './customer-auth.constants';
import type { CustomerDocument } from '../../db/schemas/customer.schema';

@Injectable()
export class CustomerJwtGuard extends AuthGuard(CUSTOMER_JWT_STRATEGY) {}

/** The logged-in customer document (set by CustomerJwtGuard). */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerDocument =>
    ctx.switchToHttp().getRequest().user,
);
