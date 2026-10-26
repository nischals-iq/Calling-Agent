import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ClientActivityLogsService,
  ActivityLogQueryDto,
} from './client-activity-logs.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';

@Controller('client/activity-logs')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ClientActivityLogsController {
  constructor(private readonly logsService: ClientActivityLogsService) {}

  @Get()
  @RequirePermissions('activity_logs:view')
  getActivityLogs(
    @CurrentTenant() tenantId: string,
    @Query() query: ActivityLogQueryDto,
  ) {
    return this.logsService.getActivityLogs(tenantId, query);
  }
}
