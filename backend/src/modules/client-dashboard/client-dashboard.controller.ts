import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClientDashboardService } from './client-dashboard.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';

@Controller('client/dashboard')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ClientDashboardController {
  constructor(private readonly dashboardService: ClientDashboardService) {}

  @Get('stats')
  getStats(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getDashboardStats(tenantId);
  }
}
