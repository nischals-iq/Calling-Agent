import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { hasPermission } from '../permissions/permissions.constants.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    const userRole = user.role;
    const userPermissions = user.permissions as string[] | undefined;

    const hasAll = requiredPermissions.every((perm) =>
      hasPermission(userRole, userPermissions, perm),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        `Insufficient permissions: required [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
