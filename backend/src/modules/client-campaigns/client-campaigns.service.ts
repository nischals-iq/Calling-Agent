import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MetaIntegrationService } from '../integrations/services/meta-integration.service.js';

@Injectable()
export class ClientCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaService: MetaIntegrationService,
  ) {}

  /**
   * Fetch all campaigns strictly scoped to the authenticated tenant
   */
  async getCampaigns(tenantId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { clientId: tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        integration: {
          select: {
            id: true,
            name: true,
            channel: true,
            metadata: true,
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });

    return campaigns.map((c) => {
      const meta = (c.integration?.metadata as Record<string, any>) || {};
      const campMeta = (c.metadata as Record<string, any>) || {};

      const adSet = campMeta.adSetId
        ? {
            id: campMeta.adSetId,
            name: campMeta.adSetName || 'Connected Ad Set',
            status: campMeta.adSetStatus || 'PAUSED',
            dailyBudget: campMeta.dailyBudget || c.budget || null,
            billingEvent: campMeta.billingEvent || 'IMPRESSIONS',
            optimizationGoal: campMeta.optimizationGoal || 'LEAD_GENERATION',
            targeting: campMeta.targeting || null,
            promotedObject: campMeta.promotedObject || null,
            createdAt: campMeta.adSetCreatedAt || null,
          }
        : null;

      return {
        id: c.id,
        name: c.name,
        source: c.source,
        status: c.status,
        spend: c.spend,
        budget: c.budget,
        startDate: c.startDate,
        endDate: c.endDate,
        platformCampaignId: c.platformCampaignId,
        metadata: c.metadata,
        adSet,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        integration: c.integration
          ? {
              id: c.integration.id,
              name: c.integration.name,
              channel: c.integration.channel,
              adAccountName: meta.adAccountName || null,
              adAccountId: meta.adAccountId || null,
            }
          : null,
        leadsCount: c._count.leads,
        objective: meta.objective || (c.source === 'META' ? 'OUTCOME_LEADS' : null),
      };
    });
  }

  /**
   * Fetch a single campaign by ID strictly scoped to the authenticated tenant
   */
  async getCampaignById(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, clientId: tenantId },
      include: {
        integration: {
          select: {
            id: true,
            name: true,
            channel: true,
            metadata: true,
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
        leads: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            createdAt: true,
            temperature: true,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const meta = (campaign.integration?.metadata as Record<string, any>) || {};
    const campMeta = (campaign.metadata as Record<string, any>) || {};

    const adSet = campMeta.adSetId
      ? {
          id: campMeta.adSetId,
          name: campMeta.adSetName || 'Connected Ad Set',
          status: campMeta.adSetStatus || 'PAUSED',
          dailyBudget: campMeta.dailyBudget || campaign.budget || null,
          billingEvent: campMeta.billingEvent || 'IMPRESSIONS',
          optimizationGoal: campMeta.optimizationGoal || 'LEAD_GENERATION',
          targeting: campMeta.targeting || null,
          promotedObject: campMeta.promotedObject || null,
          createdAt: campMeta.adSetCreatedAt || null,
        }
      : null;

    return {
      id: campaign.id,
      name: campaign.name,
      source: campaign.source,
      status: campaign.status,
      spend: campaign.spend,
      budget: campaign.budget,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      platformCampaignId: campaign.platformCampaignId,
      metadata: campaign.metadata,
      adSet,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      integration: campaign.integration
        ? {
            id: campaign.integration.id,
            name: campaign.integration.name,
            channel: campaign.integration.channel,
            adAccountName: meta.adAccountName || null,
            adAccountId: meta.adAccountId || null,
          }
        : null,
      leadsCount: campaign._count.leads,
      objective: meta.objective || (campaign.source === 'META' ? 'OUTCOME_LEADS' : null),
      recentLeads: campaign.leads,
    };
  }

  /**
   * Step 3: Creates an Ad Set for a campaign under the authenticated client
   */
  async createAdSet(
    tenantId: string,
    campaignId: string,
    dto: {
      name?: string;
      dailyBudget?: number;
      countries?: string[];
      ageMin?: number;
      ageMax?: number;
      gender?: string;
      optimizationGoal?: string;
      billingEvent?: string;
      startTime?: string;
      endTime?: string;
    },
  ) {
    return this.metaService.createAdSet(tenantId, campaignId, dto);
  }
}
