import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { InternalCampaignsService } from '../services/internal-campaigns.service.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../../common/guards/tenant.guard.js';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator.js';
import {
  CreateInternalCampaignDto,
  UpdateInternalCampaignDto,
  PublishInternalCampaignDto,
  CreateGoogleCampaignBudgetDto,
  CreateGoogleSearchCampaignDto,
  CreateGoogleAdGroupDto,
  CreateGoogleKeywordsDto,
  CreateGoogleResponsiveSearchAdDto,
} from '../dto/internal-campaign.dto.js';

@Controller('client/internal-campaigns')
@UseGuards(JwtAuthGuard, TenantGuard)
export class InternalCampaignsController {
  constructor(
    private readonly internalCampaignsService: InternalCampaignsService,
  ) {}

  @Post()
  async createInternalCampaign(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateInternalCampaignDto,
  ) {
    return this.internalCampaignsService.createInternalCampaign(tenantId, dto);
  }

  @Get()
  async getInternalCampaigns(@CurrentTenant() tenantId: string) {
    return this.internalCampaignsService.getInternalCampaigns(tenantId);
  }

  @Get(':id')
  async getInternalCampaignById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.internalCampaignsService.getInternalCampaignById(tenantId, id);
  }

  @Patch(':id')
  async updateInternalCampaign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInternalCampaignDto,
  ) {
    return this.internalCampaignsService.updateInternalCampaign(tenantId, id, dto);
  }

  @Post(':id/publish')
  async publishInternalCampaign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: PublishInternalCampaignDto,
  ) {
    return this.internalCampaignsService.publishInternalCampaign(tenantId, id, dto);
  }

  @Post(':id/google/budget')
  async createGoogleBudget(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateGoogleCampaignBudgetDto,
  ) {
    return this.internalCampaignsService.createGoogleCampaignBudget(tenantId, id, dto);
  }

  @Post(':id/google/campaign')
  async createGoogleCampaign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateGoogleSearchCampaignDto,
  ) {
    return this.internalCampaignsService.createGoogleSearchCampaign(tenantId, id, dto);
  }

  @Post(':id/google/ad-group')
  async createGoogleAdGroup(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateGoogleAdGroupDto,
  ) {
    return this.internalCampaignsService.createGoogleAdGroup(tenantId, id, dto);
  }

  @Post(':id/google/keywords')
  async createGoogleKeywords(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateGoogleKeywordsDto,
  ) {
    return this.internalCampaignsService.createGoogleKeywords(tenantId, id, dto);
  }

  @Post(':id/google/ad')
  async createGoogleResponsiveSearchAd(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateGoogleResponsiveSearchAdDto,
  ) {
    return this.internalCampaignsService.createGoogleResponsiveSearchAd(tenantId, id, dto);
  }
}



