import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ClientCampaignsService } from './client-campaigns.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';

@Controller('client/campaigns')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ClientCampaignsController {
  constructor(private readonly campaignsService: ClientCampaignsService) {}

  @Get()
  async getCampaigns(@CurrentTenant() tenantId: string) {
    return this.campaignsService.getCampaigns(tenantId);
  }

  @Get(':id')
  async getCampaignById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignsService.getCampaignById(tenantId, id);
  }

  @Post(':id/adset')
  async createAdSet(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.campaignsService.createAdSet(tenantId, id, dto);
  }
}
