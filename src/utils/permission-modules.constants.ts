/**
 * Permission modules seeded into the Permission table.
 * Routes guard with `<action>:<slug>`, e.g. `read:platform`, `update:settings`.
 */
export const PERMISSION_MODULE_DEFINITIONS = [
  { name: 'Dashboard', slug: 'dashboard' },
  { name: 'Admin Users', slug: 'admin' },
  { name: 'Roles', slug: 'role' },
  { name: 'Permissions', slug: 'permission' },
  { name: 'Login History', slug: 'login_history' },
  { name: 'Platforms', slug: 'platform' },
  { name: 'Subscription Plans', slug: 'plan' },
  { name: 'Support Tickets', slug: 'support' },
  { name: 'CMS (FAQ, Banners, Pages)', slug: 'cms' },
  { name: 'Message Templates', slug: 'template' },
  { name: 'Notifications', slug: 'notification' },
  { name: 'Settings', slug: 'settings' },
  { name: 'Integration Logs', slug: 'integration_log' },
  { name: 'Audit Trail', slug: 'audit_trail' },
] as const;
