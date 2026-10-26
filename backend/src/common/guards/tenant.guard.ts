import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Platform admins have platform-wide access
    if (user.role === UserRole.PLATFORM_ADMIN) {
      return true;
    }

    // All client users MUST have a clientId
    if (!user.clientId) {
      throw new ForbiddenException('User is not associated with an active tenant client');
    }

    // Check if route has :clientId param or body/query clientId
    const paramClientId = request.params?.clientId;
    const bodyClientId = request.body?.clientId;
    const queryClientId = request.query?.clientId;

    if (paramClientId && paramClientId !== user.clientId) {
      throw new ForbiddenException('Cross-tenant access forbidden: clientId does not match token');
    }

    if (bodyClientId && bodyClientId !== user.clientId) {
      throw new ForbiddenException('Cross-tenant access forbidden: body clientId does not match token');
    }

    if (queryClientId && queryClientId !== user.clientId) {
      throw new ForbiddenException('Cross-tenant access forbidden: query clientId does not match token');
    }

    return true;
  }
}
