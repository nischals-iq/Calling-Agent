import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    if (user.clientId) {
      return user.clientId;
    }

    // If platform admin and clientId provided in query/params
    if (user.role === UserRole.PLATFORM_ADMIN) {
      const explicitClientId = request.query?.clientId || request.params?.clientId || request.body?.clientId;
      if (explicitClientId) {
        return explicitClientId;
      }
    }

    throw new ForbiddenException('Tenant context is required');
  },
);
