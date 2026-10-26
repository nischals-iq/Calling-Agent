export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  ASSIGN = 'assign',
  EXPORT = 'export',
}

export enum PermissionModule {
  USERS = 'users',
  TEAMS = 'teams',
  LEADS = 'leads',
  PIPELINE = 'pipeline',
  CAMPAIGNS = 'campaigns',
  REPORTS = 'reports',
  SETTINGS = 'settings',
  ACTIVITY_LOGS = 'activity_logs',
}

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  PLATFORM_ADMIN: ['*'],
  CLIENT_ADMIN: ['*'],
  SALES_MANAGER: [
    'leads:view',
    'leads:create',
    'leads:edit',
    'leads:assign',
    'leads:export',
    'pipeline:view',
    'pipeline:edit',
    'teams:view',
    'teams:edit',
    'teams:assign',
    'users:view',
    'reports:view',
    'reports:export',
    'activity_logs:view',
  ],
  SALES_EXECUTIVE: [
    'leads:view',
    'leads:create',
    'leads:edit',
    'pipeline:view',
    'teams:view',
    'users:view',
    'activity_logs:view',
  ],
  MARKETING_USER: [
    'campaigns:view',
    'campaigns:create',
    'campaigns:edit',
    'campaigns:delete',
    'leads:view',
    'leads:export',
    'reports:view',
    'reports:export',
    'teams:view',
    'activity_logs:view',
  ],
  VIEWER: [
    'leads:view',
    'pipeline:view',
    'reports:view',
    'campaigns:view',
    'teams:view',
  ],
};

export function hasPermission(
  userRole: string,
  userCustomPermissions: string[] | undefined | null,
  requiredPermission: string,
): boolean {
  if (userRole === 'PLATFORM_ADMIN' || userRole === 'CLIENT_ADMIN') {
    return true;
  }

  // 1. Check custom permissions if specified
  const custom = userCustomPermissions || [];
  if (custom.includes('*') || custom.includes(requiredPermission)) {
    return true;
  }
  const [mod] = requiredPermission.split(':');
  if (custom.includes(`${mod}:*`)) {
    return true;
  }

  // 2. Fall back to role default permissions
  const defaults = ROLE_DEFAULT_PERMISSIONS[userRole] || [];
  if (defaults.includes('*') || defaults.includes(requiredPermission)) {
    return true;
  }
  if (defaults.includes(`${mod}:*`)) {
    return true;
  }

  return false;
}
