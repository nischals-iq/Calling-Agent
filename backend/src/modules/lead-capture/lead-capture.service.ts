import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LeadIngestionService } from './lead-ingestion.service.js';
import { LeadQueryDto } from './dto/lead-query.dto.js';
import { CreateManualLeadDto } from './dto/manual-lead.dto.js';
import { PreviewCsvImportDto, ConfirmCsvImportDto } from './dto/csv-import.dto.js';
import { PublicLeadCaptureDto } from './dto/public-lead-capture.dto.js';
import { ChannelType, LeadTemperature } from '@prisma/client';

@Injectable()
export class LeadCaptureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestionService: LeadIngestionService,
  ) {}

  /**
   * Fetch paginated leads scoped strictly to the authenticated tenant
   */
  async getLeads(tenantId: string, query: LeadQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = { clientId: tenantId };

    if (query.source) {
      where.source = query.source;
    }

    if (query.stageId) {
      where.stageId = query.stageId;
    }

    if (query.temperature) {
      where.temperature = query.temperature;
    }

    if (query.isDuplicate === 'true') {
      where.isDuplicate = true;
    } else if (query.isDuplicate === 'false') {
      where.isDuplicate = false;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { company: { contains: term, mode: 'insensitive' } },
        { campaignName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, leads, stats] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
        include: {
          stage: { select: { id: true, name: true, color: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          duplicateOf: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          _count: { select: { duplicates: true, activities: true } },
        },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where: { clientId: tenantId },
        _count: { id: true },
      }),
    ]);

    const duplicateCount = await this.prisma.lead.count({
      where: { clientId: tenantId, isDuplicate: true },
    });

    return {
      data: leads,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        duplicateCount,
        sourceBreakdown: stats.map((s) => ({ source: s.source, count: s._count.id })),
      },
    };
  }

  /**
   * Get single lead by ID, strictly verifying tenant ownership
   */
  async getLeadById(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, clientId: tenantId },
      include: {
        stage: true,
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        assignedTeam: { select: { id: true, name: true, type: true } },
        duplicateOf: true,
        duplicates: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            source: true,
            createdAt: true,
            duplicateReason: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found or does not belong to your organization');
    }

    return lead;
  }

  /**
   * Manual lead creation routed through Common Ingestion Service
   */
  async createManualLead(
    tenantId: string,
    creatorId: string,
    dto: CreateManualLeadDto,
    ipAddress?: string,
  ) {
    return this.ingestionService.ingestLead(
      tenantId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.mobile,
        company: dto.company,
        jobTitle: dto.jobTitle,
        source: dto.source || ChannelType.OTHER,
        campaignName: dto.campaign,
        notes: dto.notes,
        stageId: dto.stageId,
        temperature: dto.temperature || LeadTemperature.COLD,
        dealValue: dto.dealValue,
        assignedToId: dto.assignedToId,
        assignedTeamId: dto.assignedTeamId,
        customFields: dto.customFields,
      },
      {
        creatorId,
        ipAddress,
        duplicateHandling: 'FLAG',
      },
    );
  }

  /**
   * CSV Preview
   */
  async previewCsv(tenantId: string, dto: PreviewCsvImportDto) {
    return this.ingestionService.previewCsv(tenantId, dto.rawRows, dto.columnMapping);
  }

  /**
   * Confirm CSV batch import routed through Common Ingestion Service
   */
  async confirmCsvImport(
    tenantId: string,
    creatorId: string,
    dto: ConfirmCsvImportDto,
    ipAddress?: string,
  ) {
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('No rows provided for import');
    }

    const payloads = dto.rows.map((r) => ({
      firstName: r.firstName || r.name || 'Unnamed Lead',
      lastName: r.lastName,
      email: r.email,
      phone: r.phone || r.mobile,
      company: r.company,
      jobTitle: r.jobTitle,
      source: r.source || dto.defaultSource || ChannelType.CSV_IMPORT,
      campaignName: r.campaignName || r.campaign || dto.defaultCampaign,
      notes: r.notes,
      stageId: r.stageId || dto.defaultStageId,
      temperature: r.temperature || dto.defaultTemperature || LeadTemperature.COLD,
      dealValue: r.dealValue ? Number(r.dealValue) : undefined,
      customFields: r.customFields,
      duplicateHandling: dto.duplicateHandling || 'FLAG',
    }));

    return this.ingestionService.ingestBatch(tenantId, payloads, {
      creatorId,
      ipAddress,
      duplicateHandling: dto.duplicateHandling || 'FLAG',
    });
  }

  /**
   * Public Website & Webhook Lead Intake
   */
  async ingestPublicLead(
    dto: PublicLeadCaptureDto,
    authHeaderKey?: string,
    ipAddress?: string,
  ) {
    // 1. Resolve & authenticate tenant securely
    const providedKey = authHeaderKey || dto.apiKey;
    const client = await this.resolveTenantByApiKey(providedKey, dto.tenantId);

    // 2. Map payload to normalized ingestion
    return this.ingestionService.ingestLead(
      client.id,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        notes: dto.notes || dto.message,
        source: dto.source || ChannelType.WEBSITE,
        medium: dto.medium,
        campaignName: dto.campaignName,
        adId: dto.adId,
        adSetId: dto.adSetId,
        formId: dto.formId,
        landingPageUrl: dto.landingPageUrl,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        utmTerm: dto.utmTerm,
        customFields: dto.customFields,
      },
      {
        ipAddress,
        duplicateHandling: 'FLAG',
      },
    );
  }

  /**
   * Secure tenant lookup by public intake API key
   */
  async resolveTenantByApiKey(apiKey?: string, explicitTenantId?: string) {
    let client = null;

    if (apiKey) {
      client = await this.prisma.client.findFirst({
        where: { apiKey: apiKey.trim() },
        select: { id: true, name: true, status: true, plan: true },
      });
    } else if (explicitTenantId) {
      // Validate provided tenantId exists and active
      client = await this.prisma.client.findUnique({
        where: { id: explicitTenantId },
        select: { id: true, name: true, status: true, plan: true },
      });
    }

    if (!client) {
      throw new UnauthorizedException(
        'Invalid or missing Lead Capture API Key. Provide a valid X-Tenant-Key header or apiKey parameter.',
      );
    }

    if (client.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tenant client account is not active.');
    }

    return client;
  }

  /**
   * Get intake configuration, stages, and embed snippet for the client
   */
  async getCaptureConfig(tenantId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, apiKey: true, leadStages: { orderBy: { order: 'asc' } } },
    });

    if (!client) {
      throw new NotFoundException('Client organization not found');
    }

    let apiKey = client.apiKey;
    if (!apiKey) {
      apiKey = `ca_live_${crypto.randomBytes(16).toString('hex')}`;
      await this.prisma.client.update({
        where: { id: tenantId },
        data: { apiKey },
      });
    }

    return {
      tenantId: client.id,
      tenantName: client.name,
      apiKey,
      stages: client.leadStages,
      allowedSources: [
        'WEBSITE',
        'MANUAL',
        'CSV_IMPORT',
        'META',
        'GOOGLE',
        'LINKEDIN',
        'WHATSAPP',
        'REFERRAL',
        'OTHER',
      ],
      publicEndpoint: '/api/public/leads/capture',
    };
  }

  /**
   * Rotate client API Key
   */
  async rotateApiKey(tenantId: string) {
    const newApiKey = `ca_live_${crypto.randomBytes(16).toString('hex')}`;
    await this.prisma.client.update({
      where: { id: tenantId },
      data: { apiKey: newApiKey },
    });
    return { apiKey: newApiKey };
  }

  /**
   * Update lead description / notes
   */
  async updateLeadNotes(id: string, tenantId: string, notes: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, clientId: tenantId },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return this.prisma.lead.update({
      where: { id },
      data: { notes },
    });
  }
}
