import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
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
import { ChannelType } from '@prisma/client';
import { MetaIntegrationService } from '../../integrations/services/meta-integration.service.js';
import { GoogleIntegrationService } from '../../integrations/services/google-integration.service.js';

@Injectable()
export class InternalCampaignsService {
  private readonly logger = new Logger(InternalCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaIntegration: MetaIntegrationService,
    private readonly googleIntegration: GoogleIntegrationService,
  ) {}

  /**
   * Create a new Master/Internal Campaign in DRAFT status.
   * Completely tenant-scoped. Does NOT call Meta or Google publishing APIs.
   */
  async createInternalCampaign(tenantId: string, dto: CreateInternalCampaignDto) {
    // 1. Validate platform selection: at least one must be selected
    if (!dto.useMeta && !dto.useGoogle) {
      throw new BadRequestException('At least one platform (Meta or Google) must be selected.');
    }

    // 2. Validate dates
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException('Invalid date provided.');
      }
      if (end < start) {
        throw new BadRequestException('End date must be on or after start date.');
      }
    }

    // 3. Validate age range
    const minAge = dto.minAge ?? 18;
    const maxAge = dto.maxAge ?? 65;
    if (maxAge < minAge) {
      throw new BadRequestException('Maximum age must be greater than or equal to minimum age.');
    }

    // 4. Default status strictly to DRAFT
    const status = 'DRAFT';

    const internalCampaign = await this.prisma.internalCampaign.create({
      data: {
        clientId: tenantId,
        name: dto.name.trim(),
        objective: dto.objective || 'LEADS',
        totalBudget: dto.totalBudget ? Number(dto.totalBudget) : null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        landingPageUrl: dto.landingPageUrl ? dto.landingPageUrl.trim() : null,
        locations: dto.locations ? dto.locations : ['IN'],
        minAge,
        maxAge,
        gender: dto.gender || 'ALL',
        headline: dto.headline ? dto.headline.trim() : null,
        primaryText: dto.primaryText ? dto.primaryText.trim() : null,
        description: dto.description ? dto.description.trim() : null,
        callToAction: dto.callToAction ? dto.callToAction.trim() : 'LEARN_MORE',
        useMeta: Boolean(dto.useMeta),
        useGoogle: Boolean(dto.useGoogle),
        status,
      },
      include: {
        platformCampaigns: true,
      },
    });

    this.logger.log(
      `Created internal master campaign [${internalCampaign.id}] "${internalCampaign.name}" for tenant [${tenantId}] (Meta: ${internalCampaign.useMeta}, Google: ${internalCampaign.useGoogle})`,
    );

    return internalCampaign;
  }

  /**
   * Fetch all internal campaigns strictly scoped to the authenticated tenant
   */
  async getInternalCampaigns(tenantId: string) {
    return this.prisma.internalCampaign.findMany({
      where: { clientId: tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        platformCampaigns: {
          select: {
            id: true,
            name: true,
            source: true,
            status: true,
            platformCampaignId: true,
            spend: true,
            budget: true,
            metadata: true,
            _count: {
              select: { leads: true },
            },
          },
        },
      },
    });
  }

  /**
   * Fetch a single internal campaign by ID strictly scoped to the authenticated tenant
   */
  async getInternalCampaignById(tenantId: string, id: string) {
    const campaign = await this.prisma.internalCampaign.findFirst({
      where: { id, clientId: tenantId },
      include: {
        platformCampaigns: {
          select: {
            id: true,
            name: true,
            source: true,
            status: true,
            platformCampaignId: true,
            spend: true,
            budget: true,
            metadata: true,
            _count: {
              select: { leads: true },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Internal campaign [${id}] not found`);
    }

    return campaign;
  }

  /**
   * Update an existing internal campaign while it is in DRAFT status.
   * Strictly tenant-scoped.
   */
  async updateInternalCampaign(
    tenantId: string,
    id: string,
    dto: UpdateInternalCampaignDto,
  ) {
    // 1. Verify existence & tenant ownership
    const campaign = await this.prisma.internalCampaign.findFirst({
      where: { id, clientId: tenantId },
    });

    if (!campaign) {
      throw new NotFoundException(`Internal campaign [${id}] not found`);
    }

    // 2. Only allow editing DRAFT campaigns
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Only campaigns in DRAFT status can be modified.');
    }

    // 3. Validate platforms if changed
    const nextUseMeta = dto.useMeta !== undefined ? dto.useMeta : campaign.useMeta;
    const nextUseGoogle = dto.useGoogle !== undefined ? dto.useGoogle : campaign.useGoogle;
    if (!nextUseMeta && !nextUseGoogle) {
      throw new BadRequestException('At least one platform (Meta or Google) must be selected.');
    }

    // 4. Validate dates
    const startVal = dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : campaign.startDate;
    const endVal = dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : campaign.endDate;
    if (startVal && endVal && endVal < startVal) {
      throw new BadRequestException('End date must be on or after start date.');
    }

    // 5. Validate ages
    const minVal = dto.minAge !== undefined ? dto.minAge : campaign.minAge;
    const maxVal = dto.maxAge !== undefined ? dto.maxAge : campaign.maxAge;
    if (minVal !== null && maxVal !== null && maxVal < minVal) {
      throw new BadRequestException('Maximum age must be greater than or equal to minimum age.');
    }

    return this.prisma.internalCampaign.update({
      where: { id: campaign.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.objective !== undefined && { objective: dto.objective }),
        ...(dto.totalBudget !== undefined && { totalBudget: dto.totalBudget ? Number(dto.totalBudget) : null }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.landingPageUrl !== undefined && { landingPageUrl: dto.landingPageUrl ? dto.landingPageUrl.trim() : null }),
        ...(dto.locations !== undefined && { locations: dto.locations }),
        ...(dto.minAge !== undefined && { minAge: dto.minAge }),
        ...(dto.maxAge !== undefined && { maxAge: dto.maxAge }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.headline !== undefined && { headline: dto.headline ? dto.headline.trim() : null }),
        ...(dto.primaryText !== undefined && { primaryText: dto.primaryText ? dto.primaryText.trim() : null }),
        ...(dto.description !== undefined && { description: dto.description ? dto.description.trim() : null }),
        ...(dto.callToAction !== undefined && { callToAction: dto.callToAction ? dto.callToAction.trim() : null }),
        ...(dto.useMeta !== undefined && { useMeta: dto.useMeta }),
        ...(dto.useGoogle !== undefined && { useGoogle: dto.useGoogle }),
      },
      include: {
        platformCampaigns: true,
      },
    });
  }

  /**
   * Publishes an internal master campaign to the selected platform(s):
   * - 'META': Master Campaign -> Meta Campaign -> Ad Set -> Creative -> Ad
   * - 'GOOGLE': Master Campaign -> Budget -> Google Campaign -> Ad Group -> Keywords -> Ad
   * - 'BOTH': Publishes to both Meta and Google
   *
   * Safety: All created campaigns, ad sets, and ads are strictly in PAUSED status.
   */
  async publishInternalCampaign(
    tenantId: string,
    id: string,
    dto: PublishInternalCampaignDto,
  ) {
    // 1. Fetch internal campaign strictly scoped to the authenticated tenant
    const masterCampaign = await this.prisma.internalCampaign.findFirst({
      where: { id, clientId: tenantId },
      include: { platformCampaigns: true },
    });

    if (!masterCampaign) {
      throw new NotFoundException(`Internal campaign [${id}] not found`);
    }

    const { platform } = dto;

    // 2. Validate platform selection matches master campaign config
    if (platform === 'META' && !masterCampaign.useMeta) {
      throw new BadRequestException(`Internal campaign "${masterCampaign.name}" is not configured for Meta.`);
    }

    if (platform === 'GOOGLE' && !masterCampaign.useGoogle) {
      throw new BadRequestException(`Internal campaign "${masterCampaign.name}" is not configured for Google.`);
    }

    if (platform === 'BOTH' && !masterCampaign.useMeta && !masterCampaign.useGoogle) {
      throw new BadRequestException(`Internal campaign "${masterCampaign.name}" has neither Meta nor Google enabled.`);
    }

    // 3. Set status to PUBLISHING while running
    await this.prisma.internalCampaign.update({
      where: { id: masterCampaign.id },
      data: { status: 'PUBLISHING' },
    });

    const results: {
      meta?: any;
      google?: any;
    } = {};

    const errors: {
      meta?: string;
      google?: string;
    } = {};

    // 4. Publish to Meta if requested and enabled
    const shouldPublishMeta = (platform === 'META' || platform === 'BOTH') && masterCampaign.useMeta;
    if (shouldPublishMeta) {
      try {
        this.logger.log(`Publishing master campaign [${masterCampaign.id}] to Meta for tenant [${tenantId}]...`);
        const metaRes = await this.metaIntegration.publishMasterCampaignToMeta(tenantId, masterCampaign);
        results.meta = metaRes;
      } catch (err: any) {
        this.logger.error(`Failed to publish master campaign [${masterCampaign.id}] to Meta: ${err.message}`);
        errors.meta = err.message || 'Meta publishing failed';
      }
    }

    // 5. Publish to Google if requested and enabled
    const shouldPublishGoogle = (platform === 'GOOGLE' || platform === 'BOTH') && masterCampaign.useGoogle;
    if (shouldPublishGoogle) {
      try {
        this.logger.log(`Publishing master campaign [${masterCampaign.id}] to Google for tenant [${tenantId}]...`);
        const googleRes = await this.googleIntegration.publishMasterCampaignToGoogle(tenantId, masterCampaign);
        results.google = googleRes;
      } catch (err: any) {
        this.logger.error(`Failed to publish master campaign [${masterCampaign.id}] to Google: ${err.message}`);
        errors.google = err.message || 'Google publishing failed';
      }
    }

    // 6. Check overall status based on deployment results
    const updatedPlatformCampaigns = await this.prisma.campaign.findMany({
      where: { internalCampaignId: masterCampaign.id, clientId: tenantId },
      select: {
        id: true,
        name: true,
        source: true,
        status: true,
        platformCampaignId: true,
        spend: true,
        budget: true,
        metadata: true,
        _count: {
          select: { leads: true },
        },
      },
    });

    const hasMeta = updatedPlatformCampaigns.some((p) => p.source === 'META');
    const hasGoogle = updatedPlatformCampaigns.some((p) => p.source === 'GOOGLE');

    let finalStatus: string;
    if (masterCampaign.useMeta && masterCampaign.useGoogle) {
      if (hasMeta && hasGoogle) {
        finalStatus = 'PUBLISHED';
      } else if (hasMeta || hasGoogle) {
        finalStatus = 'PARTIALLY_PUBLISHED';
      } else {
        finalStatus = 'FAILED';
      }
    } else if (masterCampaign.useMeta) {
      finalStatus = hasMeta ? 'PUBLISHED' : 'FAILED';
    } else if (masterCampaign.useGoogle) {
      finalStatus = hasGoogle ? 'PUBLISHED' : 'FAILED';
    } else {
      finalStatus = 'DRAFT';
    }

    const updatedMaster = await this.prisma.internalCampaign.update({
      where: { id: masterCampaign.id },
      data: {
        status: finalStatus,
      },
      include: {
        platformCampaigns: {
          select: {
            id: true,
            name: true,
            source: true,
            status: true,
            platformCampaignId: true,
            spend: true,
            budget: true,
            metadata: true,
            _count: {
              select: { leads: true },
            },
          },
        },
      },
    });

    return {
      success: Object.keys(errors).length === 0,
      masterCampaign: updatedMaster,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };
  }

  /**
   * Step 2: Create a live Google Campaign Budget for an internal campaign blueprint
   */
  async createGoogleCampaignBudget(
    tenantId: string,
    internalCampaignId: string,
    dto?: CreateGoogleCampaignBudgetDto,
  ) {
    const internalCampaign = await this.prisma.internalCampaign.findFirst({
      where: { id: internalCampaignId, clientId: tenantId },
    });

    if (!internalCampaign) {
      throw new NotFoundException(`Internal campaign [${internalCampaignId}] not found for this tenant`);
    }

    if (!internalCampaign.useGoogle) {
      throw new BadRequestException(`Internal campaign "${internalCampaign.name}" does not have Google enabled`);
    }

    const amountInMajor = dto?.amountInMajor || (internalCampaign.totalBudget ? Number(internalCampaign.totalBudget) : 100);
    const budgetName = dto?.name || `${internalCampaign.name} Budget (${Date.now()})`;

    this.logger.log(
      `Creating Google Campaign Budget for internal campaign [${internalCampaign.id}] "${internalCampaign.name}" (Tenant: ${tenantId}, Budget: ₹${amountInMajor})...`,
    );

    // 1. Create live campaign budget via Google Ads API v25
    const budget = await this.googleIntegration.createCampaignBudget(tenantId, {
      name: budgetName,
      amountInMajor,
      explicitlyShared: dto?.explicitlyShared ?? false,
    });

    // 2. Perform live read-back verification via Google Ads API v25
    const verifiedBudget = await this.googleIntegration.getCampaignBudget(tenantId, budget.resourceName);

    // 3. Persist in FirstCall internalCampaign.metadata
    const existingMeta = (internalCampaign.metadata as Record<string, any>) || {};
    const updatedMeta = {
      ...existingMeta,
      googleBudget: {
        resourceName: verifiedBudget.resourceName,
        budgetId: verifiedBudget.id,
        customerId: budget.customerId,
        name: verifiedBudget.name,
        amountMicros: verifiedBudget.amountMicros,
        amountInMajor,
        deliveryMethod: verifiedBudget.deliveryMethod,
        explicitlyShared: verifiedBudget.explicitlyShared,
        currency: 'INR',
        status: verifiedBudget.status || 'CREATED',
        verifiedLive: true,
        createdAt: new Date().toISOString(),
      },
    };

    const updatedCampaign = await this.prisma.internalCampaign.update({
      where: { id: internalCampaign.id },
      data: { metadata: updatedMeta },
    });

    this.logger.log(
      `Google Campaign Budget successfully created and verified for internal campaign [${internalCampaign.id}]: [${verifiedBudget.resourceName}]`,
    );

    return {
      success: true,
      internalCampaignId: internalCampaign.id,
      budget: updatedMeta.googleBudget,
    };
  }

  /**
   * Step 3: Create a real Google Search Campaign under the connected Google Ads account (strictly PAUSED)
   */
  async createGoogleSearchCampaign(
    tenantId: string,
    internalCampaignId: string,
    dto?: CreateGoogleSearchCampaignDto,
  ) {
    // 1. Tenant validation
    const internalCampaign = await this.prisma.internalCampaign.findFirst({
      where: { id: internalCampaignId, clientId: tenantId },
    });

    if (!internalCampaign) {
      throw new NotFoundException(`Internal campaign [${internalCampaignId}] not found for this tenant`);
    }

    if (!internalCampaign.useGoogle) {
      throw new BadRequestException(`Internal campaign "${internalCampaign.name}" does not have Google enabled`);
    }

    // 2. Resolve Budget Resource Name
    const internalMeta = (internalCampaign.metadata as Record<string, any>) || {};
    const budgetResourceName =
      dto?.budgetResourceName ||
      internalMeta.googleBudget?.resourceName;

    if (!budgetResourceName) {
      throw new BadRequestException(
        'No Google Campaign Budget found. Please create a campaign budget (Step 2) before creating the search campaign.',
      );
    }

    const campaignName = dto?.name || `${internalCampaign.name} (Google Search)`;
    const startDate = dto?.startDate || (internalCampaign.startDate ? internalCampaign.startDate.toISOString() : undefined);
    const endDate = dto?.endDate || (internalCampaign.endDate ? internalCampaign.endDate.toISOString() : undefined);

    this.logger.log(
      `Creating Google Search Campaign for internal campaign [${internalCampaign.id}] "${campaignName}" with budget [${budgetResourceName}] (Tenant: ${tenantId})...`,
    );

    // 3. Create live Search Campaign via Google Ads API v25 (strictly PAUSED)
    const created = await this.googleIntegration.createSearchCampaign(tenantId, {
      name: campaignName,
      budgetResourceName,
      startDate,
      endDate,
    });

    // 4. Perform live read-back verification via Google Ads API v25
    const verified = await this.googleIntegration.getSearchCampaign(tenantId, created.resourceName);

    // 5. Persist platform Campaign record in FirstCall CRM
    const googleAccount = await this.googleIntegration.resolveGoogleAccount(tenantId);
    const budgetAmount = internalMeta.googleBudget?.amountInMajor || (internalCampaign.totalBudget ? Number(internalCampaign.totalBudget) : 100);

    const existingDeployment = await this.prisma.campaign.findFirst({
      where: {
        internalCampaignId: internalCampaign.id,
        clientId: tenantId,
        source: ChannelType.GOOGLE,
      },
    });

    const deploymentMetadata = {
      googleCampaignResourceName: verified.resourceName,
      googleBudgetResourceName: verified.campaignBudget,
      advertisingChannelType: verified.advertisingChannelType,
      customerId: created.customerId,
      verifiedLive: true,
      createdAt: new Date().toISOString(),
    };

    let platformCampaign;
    if (existingDeployment) {
      platformCampaign = await this.prisma.campaign.update({
        where: { id: existingDeployment.id },
        data: {
          platformCampaignId: verified.id,
          name: verified.name,
          status: 'PAUSED',
          budget: budgetAmount,
          metadata: deploymentMetadata,
        },
      });
    } else {
      platformCampaign = await this.prisma.campaign.create({
        data: {
          clientId: tenantId,
          internalCampaignId: internalCampaign.id,
          integrationId: googleAccount.integration.id,
          name: verified.name,
          source: ChannelType.GOOGLE,
          platformCampaignId: verified.id,
          status: 'PAUSED',
          budget: budgetAmount,
          startDate: internalCampaign.startDate,
          endDate: internalCampaign.endDate,
          metadata: deploymentMetadata,
        },
      });
    }

    // 6. Attach campaign reference to internalCampaign.metadata
    const updatedMeta = {
      ...internalMeta,
      googleCampaign: {
        resourceName: verified.resourceName,
        campaignId: verified.id,
        customerId: created.customerId,
        name: verified.name,
        status: verified.status,
        advertisingChannelType: verified.advertisingChannelType,
        budgetResourceName: verified.campaignBudget,
        platformCampaignRecordId: platformCampaign.id,
        verifiedLive: true,
        createdAt: new Date().toISOString(),
      },
    };

    await this.prisma.internalCampaign.update({
      where: { id: internalCampaign.id },
      data: { metadata: updatedMeta },
    });

    this.logger.log(
      `Google Search Campaign successfully created, verified, and persisted: [${verified.resourceName}] (ID: ${verified.id})`,
    );

    return {
      success: true,
      internalCampaignId: internalCampaign.id,
      platformCampaignId: platformCampaign.id,
      campaign: updatedMeta.googleCampaign,
    };
  }

  /**
   * Step 4: Create a real Google Ad Group under the existing Google Search Campaign (strictly PAUSED)
   */
  async createGoogleAdGroup(
    tenantId: string,
    internalCampaignId: string,
    dto?: CreateGoogleAdGroupDto,
  ) {
    // 1. Tenant validation
    const internalCampaign = await this.prisma.internalCampaign.findFirst({
      where: { id: internalCampaignId, clientId: tenantId },
    });

    if (!internalCampaign) {
      throw new NotFoundException(`Internal campaign [${internalCampaignId}] not found for this tenant`);
    }

    if (!internalCampaign.useGoogle) {
      throw new BadRequestException(`Internal campaign "${internalCampaign.name}" does not have Google enabled`);
    }

    // 2. Resolve Campaign Resource Name
    const internalMeta = (internalCampaign.metadata as Record<string, any>) || {};
    let campaignResourceName = dto?.campaignResourceName || internalMeta.googleCampaign?.resourceName;

    if (!campaignResourceName) {
      const existingDeployment = await this.prisma.campaign.findFirst({
        where: {
          internalCampaignId: internalCampaign.id,
          clientId: tenantId,
          source: ChannelType.GOOGLE,
        },
      });
      const deployMeta = (existingDeployment?.metadata as Record<string, any>) || {};
      campaignResourceName = deployMeta.googleCampaignResourceName;
    }

    if (!campaignResourceName) {
      throw new BadRequestException(
        'No Google Search Campaign found. Please create a search campaign (Step 3) before creating the Ad Group.',
      );
    }

    const adGroupName = dto?.name || `${internalCampaign.name} Ad Group`;
    const cpcBidMicros = dto?.cpcBidInMajor
      ? String(Math.round(dto.cpcBidInMajor * 1000000))
      : '10000000'; // Default ₹10 = 10,000,000 micros

    this.logger.log(
      `Creating Google Ad Group for internal campaign [${internalCampaign.id}] "${adGroupName}" under campaign [${campaignResourceName}] (Tenant: ${tenantId})...`,
    );

    // 3. Create live Ad Group via Google Ads API v25 (strictly PAUSED)
    const created = await this.googleIntegration.createAdGroup(tenantId, {
      name: adGroupName,
      campaignResourceName,
      cpcBidMicros,
    });

    // 4. Perform live read-back verification via Google Ads API v25
    const verified = await this.googleIntegration.getAdGroup(tenantId, created.resourceName);

    // 5. Update platform Campaign record in FirstCall CRM
    const existingDeployment = await this.prisma.campaign.findFirst({
      where: {
        internalCampaignId: internalCampaign.id,
        clientId: tenantId,
        source: ChannelType.GOOGLE,
      },
    });

    if (existingDeployment) {
      const deployMeta = (existingDeployment.metadata as Record<string, any>) || {};
      await this.prisma.campaign.update({
        where: { id: existingDeployment.id },
        data: {
          metadata: {
            ...deployMeta,
            googleAdGroupId: verified.id,
            googleAdGroupResourceName: verified.resourceName,
            adGroupName: verified.name,
            adGroupStatus: verified.status,
            adGroupType: verified.type,
            cpcBidMicros: verified.cpcBidMicros,
            adGroupVerifiedLive: true,
          },
        },
      });
    }

    // 6. Attach Ad Group reference to internalCampaign.metadata
    const updatedMeta = {
      ...internalMeta,
      googleAdGroup: {
        resourceName: verified.resourceName,
        adGroupId: verified.id,
        name: verified.name,
        status: verified.status,
        type: verified.type,
        campaignResourceName: verified.campaign,
        cpcBidMicros: verified.cpcBidMicros,
        verifiedLive: true,
        createdAt: new Date().toISOString(),
      },
    };

    await this.prisma.internalCampaign.update({
      where: { id: internalCampaign.id },
      data: { metadata: updatedMeta },
    });

    this.logger.log(
      `Google Ad Group successfully created, verified, and persisted: [${verified.resourceName}] (ID: ${verified.id})`,
    );

    return {
      success: true,
      internalCampaignId: internalCampaign.id,
      adGroup: updatedMeta.googleAdGroup,
    };
  }

  /**
   * Step 5: Create Google Search Keywords under the existing Google Ad Group
   * Endpoint: POST /api/client/internal-campaigns/:id/google/keywords
   */
  async createGoogleKeywords(
    tenantId: string,
    internalCampaignId: string,
    dto?: CreateGoogleKeywordsDto,
  ) {
    // 1. Tenant validation
    const internalCampaign = await this.prisma.internalCampaign.findFirst({
      where: { id: internalCampaignId, clientId: tenantId },
    });

    if (!internalCampaign) {
      throw new NotFoundException(`Internal campaign [${internalCampaignId}] not found for this tenant`);
    }

    if (!internalCampaign.useGoogle) {
      throw new BadRequestException(`Internal campaign "${internalCampaign.name}" does not have Google enabled`);
    }

    // 2. Resolve Ad Group Resource Name
    const internalMeta = (internalCampaign.metadata as Record<string, any>) || {};
    let adGroupResourceName = dto?.adGroupResourceName || internalMeta.googleAdGroup?.resourceName;

    const existingDeployment = await this.prisma.campaign.findFirst({
      where: {
        internalCampaignId: internalCampaign.id,
        clientId: tenantId,
        source: ChannelType.GOOGLE,
      },
    });

    if (!adGroupResourceName && existingDeployment) {
      const deployMeta = (existingDeployment.metadata as Record<string, any>) || {};
      adGroupResourceName = deployMeta.googleAdGroupResourceName;
    }

    if (!adGroupResourceName) {
      throw new BadRequestException(
        'No Google Ad Group found. Please create an Ad Group (Step 4) before creating Keywords.',
      );
    }

    // 3. Prepare target keywords (default test keywords if none specified)
    const rawKeywords =
      dto?.keywords && dto.keywords.length > 0
        ? dto.keywords
        : [
            { text: 'ai lead generation', matchType: 'PHRASE' as const },
            { text: 'crm automation', matchType: 'PHRASE' as const },
            { text: 'sales automation software', matchType: 'PHRASE' as const },
          ];

    this.logger.log(
      `Checking existing keywords for internal campaign [${internalCampaign.id}] under ad group [${adGroupResourceName}] (Tenant: ${tenantId})...`,
    );

    // 4. Check existing keywords to avoid duplicate creation on retry
    const existingKeywords = await this.googleIntegration.getAdGroupKeywords(
      tenantId,
      adGroupResourceName,
    );
    const existingKeySet = new Set(
      existingKeywords.map((k) => `${k.text.trim().toLowerCase()}|${k.matchType.toUpperCase()}`),
    );

    const keywordsToCreate = rawKeywords.filter((k) => {
      const key = `${k.text.trim().toLowerCase()}|${(k.matchType || 'PHRASE').toUpperCase()}`;
      return !existingKeySet.has(key);
    });

    if (keywordsToCreate.length > 0) {
      this.logger.log(
        `Creating ${keywordsToCreate.length} new keywords in Google Ads v25 under ad group [${adGroupResourceName}]...`,
      );
      await this.googleIntegration.createKeywords(tenantId, {
        adGroupResourceName,
        keywords: keywordsToCreate,
      });
    } else {
      this.logger.log(
        `All ${rawKeywords.length} keywords already exist under ad group [${adGroupResourceName}]. Skipping duplicate creation.`,
      );
    }

    // 5. Perform live read-back verification via Google Ads API v25 GAQL search
    const allVerifiedKeywords = await this.googleIntegration.getAdGroupKeywords(
      tenantId,
      adGroupResourceName,
    );

    const googleKeywords = allVerifiedKeywords.map((kw) => ({
      criterionId: kw.criterionId,
      resourceName: kw.resourceName,
      text: kw.text,
      matchType: kw.matchType,
      status: kw.status,
      adGroup: kw.adGroup,
      verifiedLive: true,
    }));

    // 6. Update platform Campaign deployment record in FirstCall CRM
    if (existingDeployment) {
      const deployMeta = (existingDeployment.metadata as Record<string, any>) || {};
      await this.prisma.campaign.update({
        where: { id: existingDeployment.id },
        data: {
          metadata: {
            ...deployMeta,
            googleKeywords,
            keywordsCount: googleKeywords.length,
            keywordsVerifiedLive: true,
          },
        },
      });
    }

    // 7. Update internalCampaign.metadata
    const updatedMeta = {
      ...internalMeta,
      googleKeywords,
      keywordsCount: googleKeywords.length,
      keywordsVerifiedLive: true,
      keywordsUpdatedAt: new Date().toISOString(),
    };

    await this.prisma.internalCampaign.update({
      where: { id: internalCampaign.id },
      data: { metadata: updatedMeta },
    });

    this.logger.log(
      `Google Search Keywords successfully verified and persisted: ${googleKeywords.length} keywords under ad group [${adGroupResourceName}]`,
    );

    return {
      success: true,
      internalCampaignId: internalCampaign.id,
      adGroupResourceName,
      keywords: googleKeywords,
      count: googleKeywords.length,
    };
  }

  /**
   * Step 6: Create Google Responsive Search Ad under the existing Google Ad Group
   * Endpoint: POST /api/client/internal-campaigns/:id/google/ad
   */
  async createGoogleResponsiveSearchAd(
    tenantId: string,
    internalCampaignId: string,
    dto?: CreateGoogleResponsiveSearchAdDto,
  ) {
    // 1. Tenant validation
    const internalCampaign = await this.prisma.internalCampaign.findFirst({
      where: { id: internalCampaignId, clientId: tenantId },
    });

    if (!internalCampaign) {
      throw new NotFoundException(`Internal campaign [${internalCampaignId}] not found for this tenant`);
    }

    if (!internalCampaign.useGoogle) {
      throw new BadRequestException(`Internal campaign "${internalCampaign.name}" does not have Google enabled`);
    }

    // 2. Resolve Ad Group Resource Name
    const internalMeta = (internalCampaign.metadata as Record<string, any>) || {};
    let adGroupResourceName = dto?.adGroupResourceName || internalMeta.googleAdGroup?.resourceName;

    const existingDeployment = await this.prisma.campaign.findFirst({
      where: {
        internalCampaignId: internalCampaign.id,
        clientId: tenantId,
        source: ChannelType.GOOGLE,
      },
    });

    if (!adGroupResourceName && existingDeployment) {
      const deployMeta = (existingDeployment.metadata as Record<string, any>) || {};
      adGroupResourceName = deployMeta.googleAdGroupResourceName;
    }

    if (!adGroupResourceName) {
      throw new BadRequestException(
        'No Google Ad Group found. Please create an Ad Group (Step 4) before creating a Responsive Search Ad.',
      );
    }

    // 3. Prepare ad content
    const headlines =
      dto?.headlines && dto.headlines.length >= 3
        ? dto.headlines
        : [
            'AI Lead Generation Platform',
            'Automate Your Sales Pipeline',
            'Smarter CRM Automation',
          ];

    const descriptions =
      dto?.descriptions && dto.descriptions.length >= 2
        ? dto.descriptions
        : [
            'Generate and manage qualified leads with AI-powered automation.',
            'Automate lead follow-up, CRM workflows, and sales outreach.',
          ];

    const finalUrl = dto?.finalUrl || internalCampaign.landingPageUrl || 'https://firstcall.ai';

    this.logger.log(
      `Checking existing Ads for internal campaign [${internalCampaign.id}] under ad group [${adGroupResourceName}] (Tenant: ${tenantId})...`,
    );

    // 4. Check existing Ads to avoid duplicate creation on retry
    const existingAds = await this.googleIntegration.getAdGroupAds(tenantId, adGroupResourceName);
    let liveAd: any = null;

    if (existingAds.length > 0) {
      this.logger.log(
        `Found existing Ad [${existingAds[0].resourceName}] under ad group [${adGroupResourceName}]. Skipping duplicate creation on retry.`,
      );
      liveAd = existingAds[0];
    } else {
      this.logger.log(
        `Creating new Google Ads v25 Responsive Search Ad for internal campaign [${internalCampaign.id}] under ad group [${adGroupResourceName}]...`,
      );
      liveAd = await this.googleIntegration.createResponsiveSearchAd(tenantId, {
        adGroupResourceName,
        headlines,
        descriptions,
        finalUrls: [finalUrl],
      });
    }

    // 5. Perform live read-back verification via Google Ads API v25 GAQL search
    const allVerifiedAds = await this.googleIntegration.getAdGroupAds(tenantId, adGroupResourceName);
    const verifiedAd = allVerifiedAds.find((a) => a.adId === liveAd.adId) || allVerifiedAds[0] || liveAd;

    const googleResponsiveSearchAd = {
      adId: verifiedAd.adId,
      resourceName: verifiedAd.resourceName,
      adGroupResourceName,
      headlines: verifiedAd.headlines && verifiedAd.headlines.length > 0 ? verifiedAd.headlines : headlines,
      descriptions: verifiedAd.descriptions && verifiedAd.descriptions.length > 0 ? verifiedAd.descriptions : descriptions,
      finalUrls: verifiedAd.finalUrls && verifiedAd.finalUrls.length > 0 ? verifiedAd.finalUrls : [finalUrl],
      status: verifiedAd.status || 'PAUSED',
      verifiedLive: true,
      createdAt: new Date().toISOString(),
    };

    // 6. Update platform Campaign deployment record in FirstCall CRM
    if (existingDeployment) {
      const deployMeta = (existingDeployment.metadata as Record<string, any>) || {};
      await this.prisma.campaign.update({
        where: { id: existingDeployment.id },
        data: {
          metadata: {
            ...deployMeta,
            googleAdId: verifiedAd.adId,
            googleAdResourceName: verifiedAd.resourceName,
            googleResponsiveSearchAd,
            adVerifiedLive: true,
          },
        },
      });
    }

    // 7. Update internalCampaign.metadata
    const updatedMeta = {
      ...internalMeta,
      googleResponsiveSearchAd,
      adVerifiedLive: true,
      adUpdatedAt: new Date().toISOString(),
    };

    await this.prisma.internalCampaign.update({
      where: { id: internalCampaign.id },
      data: { metadata: updatedMeta },
    });

    this.logger.log(
      `Google Responsive Search Ad successfully verified and persisted: [${verifiedAd.resourceName}] (ID: ${verifiedAd.adId}) under ad group [${adGroupResourceName}]`,
    );

    return {
      success: true,
      internalCampaignId: internalCampaign.id,
      adGroupResourceName,
      ad: googleResponsiveSearchAd,
    };
  }
}



