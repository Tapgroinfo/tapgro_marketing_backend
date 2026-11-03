import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

type PermissionFlags = {
  is_create: boolean;
  is_view: boolean;
  is_edit: boolean;
  is_delete: boolean;
};

const ACTION_TO_FIELD: Record<string, keyof PermissionFlags> = {
  create: 'is_create',
  read: 'is_view',
  view: 'is_view',
  update: 'is_edit',
  edit: 'is_edit',
  delete: 'is_delete',
};

const SUPER_ROLES = ['admin', 'superadmin'];

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

    const roleName = String(user.role.role || '').toLowerCase();
    if (SUPER_ROLES.includes(roleName)) {
      return true;
    }

    // Role permissions OR-merged with per-user overrides
    const merged = new Map<string, PermissionFlags>();
    const sources: any[] = [
      ...(user.role.permissions || []),
      ...(user.permissions || []),
    ];
    for (const row of sources) {
      if (!row?.module) continue;
      const key = String(row.module).toLowerCase();
      const existing = merged.get(key);
      merged.set(key, {
        is_create: !!existing?.is_create || !!row.is_create,
        is_view: !!existing?.is_view || !!row.is_view,
        is_edit: !!existing?.is_edit || !!row.is_edit,
        is_delete: !!existing?.is_delete || !!row.is_delete,
      });
    }

    const allowed = requiredPermissions.every((required) => {
      const [action = 'read', module = ''] = required.split(':');
      const field = ACTION_TO_FIELD[action.toLowerCase()] ?? 'is_view';
      return !!merged.get(module.toLowerCase())?.[field];
    });

    if (!allowed) {
      throw new ForbiddenException(
        'You do not have the required permissions to perform this action',
      );
    }
    return true;
  }
}
