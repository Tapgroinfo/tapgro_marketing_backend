/**
 * Permission modules seeded into the Permission table.
 * Routes guard with `<action>:<slug>`, e.g. `read:platform`, `update:settings`.
 */
export const PERMISSION_MODULE_DEFINITIONS = [
  { name: 'Admin Users', slug: 'admin' },
  { name: 'Roles', slug: 'role' },
  { name: 'Permissions', slug: 'permission' },
  { name: 'Platforms', slug: 'platform' },
  { name: 'Settings', slug: 'settings' },
  { name: 'Audit Trail', slug: 'audit_trail' },
] as const;
