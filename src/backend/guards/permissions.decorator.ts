import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Enforce permission checks on a route. Format: `<action>:<module slug>`
 * where action is create | read | update | delete (e.g. 'read:platform').
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
