import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { hasPermissions } from '../../utils/permission-check.util';

/** Must run after JwtOnAuthGuard so `request.user` is populated. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user;
    if (!user) {
      throw new ForbiddenException('User session not found');
    }
    if (!user.role) {
      throw new ForbiddenException(
        'You do not have a role assigned. Permission denied.',
      );
    }
    if (!hasPermissions(user, requiredPermissions)) {
      throw new ForbiddenException(
        'You do not have the required permissions to perform this action',
      );
    }
    return true;
  }
}
