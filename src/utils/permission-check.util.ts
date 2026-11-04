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

type AdminLike = {
  role?: unknown;
  permissions?: any[];
};

export function isSuperAdmin(user: AdminLike): boolean {
  const role = user.role as { role?: string } | null | undefined;
  return SUPER_ROLES.includes(String(role?.role || '').toLowerCase());
}

/**
 * True when the admin (with populated role) holds every `<action>:<slug>`
 * permission. Role and per-user permissions are OR-merged.
 */
export function hasPermissions(user: AdminLike, required: string[]): boolean {
  if (isSuperAdmin(user)) return true;

  const role = user.role as { permissions?: any[] } | null | undefined;
  const merged = new Map<string, PermissionFlags>();
  for (const row of [
    ...(role?.permissions || []),
    ...(user.permissions || []),
  ]) {
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

  return required.every((permission) => {
    const [action = 'read', module = ''] = permission.split(':');
    const field = ACTION_TO_FIELD[action.toLowerCase()] ?? 'is_view';
    return !!merged.get(module.toLowerCase())?.[field];
  });
}
