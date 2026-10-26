import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface.js';
import { ChannelType, UserRole } from '@prisma/client';

@Controller()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  // ---------------------------------------------------------------------------
  // PLATFORM ADMIN CONFIGURATION ENDPOINTS
  // ---------------------------------------------------------------------------

  @Get('admin/clients/:clientId/integrations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async getClientIntegrations(@Param('clientId') clientId: string) {
    return this.integrationsService.getClientIntegrations(clientId);
  }

  @Get('admin/clients/:clientId/integrations/:channel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async getClientIntegration(
    @Param('clientId') clientId: string,
    @Param('channel') channel: ChannelType,
  ) {
    return this.integrationsService.getClientIntegrationByChannel(clientId, channel);
  }

  @Post('admin/clients/:clientId/integrations/:channel/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async saveIntegrationConfig(
    @Param('clientId') clientId: string,
    @Param('channel') channel: ChannelType,
    @Body() dto: Record<string, any>,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.integrationsService.saveIntegrationConfig(clientId, channel, dto, user.id, ip);
  }

  @Patch('admin/clients/:clientId/integrations/:channel/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async patchIntegrationConfig(
    @Param('clientId') clientId: string,
    @Param('channel') channel: ChannelType,
    @Body() dto: Record<string, any>,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.integrationsService.saveIntegrationConfig(clientId, channel, dto, user.id, ip);
  }

  @Post('admin/clients/:clientId/integrations/:channel/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async testIntegration(
    @Param('clientId') clientId: string,
    @Param('channel') channel: ChannelType,
  ) {
    return this.integrationsService.testIntegration(clientId, channel);
  }

  @Post('admin/clients/:clientId/integrations/:channel/connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async initiateConnect(
    @Param('clientId') clientId: string,
    @Param('channel') channel: ChannelType,
    @Body('redirectUri') redirectUri?: string,
  ) {
    return this.integrationsService.initiateConnect(clientId, channel, redirectUri);
  }

  @Post('admin/clients/:clientId/integrations/:channel/disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async disconnect(
    @Param('clientId') clientId: string,
    @Param('channel') channel: ChannelType,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.integrationsService.disconnectIntegration(clientId, channel, user.id, ip);
  }

  @Patch('admin/clients/:clientId/integrations/:channel/select-source')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async selectSource(
    @Param('clientId') clientId: string,
    @Param('channel') channel: ChannelType,
    @Body() selection: Record<string, any>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.selectSource(clientId, channel, selection, user.id);
  }

  @Post('admin/clients/:clientId/integrations/meta/subscribe-page')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async subscribeMetaPage(
    @Param('clientId') clientId: string,
    @Body('pageId') pageId?: string,
  ) {
    return this.integrationsService.subscribeMetaPage(clientId, pageId);
  }

  @Get('admin/clients/:clientId/integrations/meta/subscription-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async getMetaSubscriptionStatus(@Param('clientId') clientId: string) {
    return this.integrationsService.checkMetaPageSubscription(clientId);
  }

  @Post('admin/clients/:clientId/integrations/meta/test-campaign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async createMetaTestCampaign(
    @Param('clientId') clientId: string,
    @Body('campaignName') campaignName?: string,
  ) {
    return this.integrationsService.createMetaTestCampaign(clientId, campaignName);
  }

  @Post('admin/integrations/meta/test-campaign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async createMetaTestCampaignByBody(
    @Body('clientId') clientId: string,
    @Body('campaignName') campaignName?: string,
  ) {
    return this.integrationsService.createMetaTestCampaign(clientId, campaignName);
  }

  // ---------------------------------------------------------------------------
  // CLIENT PORTAL READ-ONLY STATUS ENDPOINT
  // ---------------------------------------------------------------------------

  @Get('client/integrations')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getClientStatus(@CurrentTenant() tenantId: string) {
    const list = await this.integrationsService.getClientIntegrations(tenantId);
    // Return only public status and account names, completely omit credentials object
    return list.map((i) => ({
      id: i.id,
      channel: i.channel,
      name: i.name,
      status: i.status,
      connectedAccount: i.metadata.pageName || i.metadata.accountName || i.metadata.organizationName || null,
      selectedForm: i.metadata.formName || i.metadata.leadFormName || null,
      lastSyncedAt: i.lastSyncedAt,
    }));
  }
}
