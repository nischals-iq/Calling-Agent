import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { IngestLeadPayload } from './dto/lead-ingestion-payload.dto.js';
import { ChannelType, LeadTemperature, ActivityType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeadCreatedEvent } from './events/lead-created.event.js';
import { randomUUID } from 'crypto';

export interface IngestLeadResult {
  success: boolean;
  lead: any;
  isDuplicate: boolean;
  duplicateOfId?: string | null;
  duplicateReason?: string | null;
  skipped?: boolean;
}

export interface BatchIngestResult {
  total: number;
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
  errorCount: number;
  errors: { row: number; reason: string; data?: any }[];
  leads: any[];
}

@Injectable()
export class LeadIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Common unified lead ingestion engine
   * Flow: Validation -> Duplicate Check -> Attribution Metadata -> Tenant Assignment -> Save Lead
   */
  async ingestLead(
    tenantId: string,
    payload: IngestLeadPayload,
    options?: {
      creatorId?: string;
      ipAddress?: string;
      duplicateHandling?: 'FLAG' | 'SKIP' | 'REJECT';
    },
  ): Promise<IngestLeadResult> {
    const duplicateHandling = options?.duplicateHandling || payload.duplicateHandling || 'FLAG';

    // 1. Validate Tenant & Active Status
    const client = await this.prisma.client.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, status: true, plan: true },
    });

    if (!client) {
      throw new NotFoundException('Client tenant organization not found');
    }

    if (client.status !== 'ACTIVE') {
      throw new BadRequestException('Client tenant organization is currently inactive or suspended');
    }

    // 2. Validate & Normalize Payload
    const firstName = payload.firstName?.trim();
    if (!firstName) {
      throw new BadRequestException('Lead first name is required');
    }

    const lastName = payload.lastName?.trim() || null;
    const email = payload.email?.toLowerCase().trim() || null;
    const rawPhone = payload.phone?.trim() || null;
    // Normalize phone by removing spaces and dashes, keeping digits and plus
    const phone = rawPhone ? rawPhone.replace(/[\s\-()]/g, '') : null;
    const alternatePhone = payload.alternatePhone?.trim() || null;
    const company = payload.company?.trim() || null;
    const jobTitle = payload.jobTitle?.trim() || null;

    // Contact requirement: At least email or phone is recommended for meaningful CRM leads
    if (!email && !phone) {
      // Allowed if manual entry provided with note, but flag or accept
    }

    // 3. Resolve Stage
    let stageId = payload.stageId;
    if (!stageId) {
      const defaultStage = await this.prisma.leadStage.findFirst({
        where: { clientId: tenantId },
        orderBy: { order: 'asc' },
      });

      if (defaultStage) {
        stageId = defaultStage.id;
      } else {
        // Auto-create initial 'New' stage if client has no stages yet
        const createdStage = await this.prisma.leadStage.create({
          data: {
            clientId: tenantId,
            name: 'New',
            order: 1,
            color: '#3B82F6',
            probability: 10,
          },
        });
        stageId = createdStage.id;
      }
    } else {
      // Verify stageId belongs to this tenant to prevent cross-tenant injection
      const stage = await this.prisma.leadStage.findFirst({
        where: { id: stageId, clientId: tenantId },
      });
      if (!stage) {
        throw new BadRequestException('Selected pipeline stage does not belong to this tenant organization');
      }
    }

    // 4. Duplicate Detection (by Email or Phone within this tenant)
    let isDuplicate = false;
    let duplicateOfId: string | null = null;
    let duplicateReason: string | null = null;

    const duplicateChecks: any[] = [];
    if (email) {
      duplicateChecks.push({ email });
    }
    if (phone) {
      duplicateChecks.push({ phone });
    }

    if (duplicateChecks.length > 0) {
      const existingLead = await this.prisma.lead.findFirst({
        where: {
          clientId: tenantId,
          OR: duplicateChecks,
        },
        orderBy: { createdAt: 'asc' }, // Match original primary lead
      });

      if (existingLead) {
        const matchesEmail = email && existingLead.email === email;
        const matchesPhone = phone && existingLead.phone === phone;

        if (matchesEmail && matchesPhone) {
          duplicateReason = 'MATCHED_EMAIL_AND_PHONE';
        } else if (matchesEmail) {
          duplicateReason = 'MATCHED_EMAIL';
        } else {
          duplicateReason = 'MATCHED_PHONE';
        }

        if (duplicateHandling === 'REJECT') {
          throw new ConflictException(
            `Duplicate lead detected: An existing lead with this ${
              matchesEmail ? 'email' : 'phone'
            } already exists in your workspace (${existingLead.firstName} ${existingLead.lastName || ''}).`,
          );
        }

        if (duplicateHandling === 'SKIP') {
          return {
            success: true,
            lead: existingLead,
            isDuplicate: true,
            duplicateOfId: existingLead.id,
            duplicateReason,
            skipped: true,
          };
        }

        // FLAG mode: mark as duplicate and link to existing
        isDuplicate = true;
        duplicateOfId = existingLead.id;

        // Increment duplicate count on existing lead
        await this.prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            duplicateCount: { increment: 1 },
          },
        });

        // Record duplicate hit on existing lead's activity timeline
        await this.prisma.leadActivity.create({
          data: {
            clientId: tenantId,
            leadId: existingLead.id,
            userId: options?.creatorId || null,
            type: ActivityType.NOTE,
            title: 'Duplicate Submission Received',
            description: `A duplicate inquiry was captured from source "${payload.source || 'WEBSITE'}". Match reason: ${duplicateReason}`,
            metadata: {
              newSource: payload.source,
              campaignName: payload.campaignName,
              utmSource: payload.utmSource,
              receivedAt: new Date().toISOString(),
            },
          },
        });
      }
    }

    // 5. Attribution & Source Metadata
    const source = payload.source || ChannelType.WEBSITE;
    const medium = payload.medium?.trim() || null;
    const campaignName = payload.campaignName?.trim() || null;
    const campaignId = payload.campaignId?.trim() || null;
    const adSetId = payload.adSetId?.trim() || null;
    const adId = payload.adId?.trim() || null;
    const formId = payload.formId?.trim() || null;
    const landingPageUrl = payload.landingPageUrl?.trim() || null;
    const utmSource = payload.utmSource?.trim() || null;
    const utmMedium = payload.utmMedium?.trim() || null;
    const utmCampaign = payload.utmCampaign?.trim() || null;
    const utmContent = payload.utmContent?.trim() || null;
    const utmTerm = payload.utmTerm?.trim() || null;
    const notes = payload.notes?.trim() || null;
    const temperature = payload.temperature || LeadTemperature.COLD;
    const dealValue = payload.dealValue !== undefined ? Number(payload.dealValue) : null;
    const customFields = payload.customFields ? (payload.customFields as any) : undefined;

    // 6. Save Lead
    const newLead = await this.prisma.lead.create({
      data: {
        clientId: tenantId,
        firstName,
        lastName,
        email,
        phone,
        alternatePhone,
        company,
        jobTitle,
        stageId: stageId!,
        temperature,
        dealValue,
        source,
        medium,
        campaignId,
        campaignName,
        adSetId,
        adId,
        formId,
        landingPageUrl,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        notes,
        isDuplicate,
        duplicateOfId,
        duplicateReason,
        customFields,
        assignedToId: payload.assignedToId || null,
        assignedTeamId: payload.assignedTeamId || null,
      },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        duplicateOf: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    // 7. Record Ingestion Activity Log
    await this.prisma.leadActivity.create({
      data: {
        clientId: tenantId,
        leadId: newLead.id,
        userId: options?.creatorId || null,
        type: ActivityType.STATUS_CHANGE,
        title: isDuplicate ? 'Lead Captured (Flagged Duplicate)' : 'Lead Captured',
        description: `Lead received via channel "${source}"${campaignName ? ` for campaign "${campaignName}"` : ''}.`,
        metadata: {
          source,
          utmSource,
          utmMedium,
          utmCampaign,
          landingPageUrl,
          isDuplicate,
          duplicateReason,
          ipAddress: options?.ipAddress,
        },
      },
    });

    // 8. Platform Audit Log
    await this.auditLogsService.log({
      clientId: tenantId,
      userId: options?.creatorId || undefined,
      action: 'LEAD_CAPTURED',
      resource: 'Lead',
      resourceId: newLead.id,
      details: {
        name: `${firstName} ${lastName || ''}`.trim(),
        email,
        phone,
        source,
        isDuplicate,
        duplicateReason,
      },
      ipAddress: options?.ipAddress,
    });

    // 9. Emit lead.created internal event for downstream workflows
    const leadCreatedEvent = new LeadCreatedEvent({
      eventId: randomUUID(),
      leadId: newLead.id,
      clientId: newLead.clientId,
      source: newLead.source,
      createdAt: newLead.createdAt,
    });
    this.eventEmitter.emit('lead.created', leadCreatedEvent);

    return {
      success: true,
      lead: newLead,
      isDuplicate,
      duplicateOfId,
      duplicateReason,
    };
  }

  /**
   * Batch ingest leads (used by CSV Bulk Import)
   */
  async ingestBatch(
    tenantId: string,
    items: IngestLeadPayload[],
    options?: {
      creatorId?: string;
      ipAddress?: string;
      duplicateHandling?: 'FLAG' | 'SKIP';
    },
  ): Promise<BatchIngestResult> {
    const duplicateHandling = options?.duplicateHandling || 'FLAG';
    const leads: any[] = [];
    const errors: { row: number; reason: string; data?: any }[] = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const result = await this.ingestLead(tenantId, item, {
          creatorId: options?.creatorId,
          ipAddress: options?.ipAddress,
          duplicateHandling,
        });

        if (result.skipped) {
          skippedCount++;
        } else {
          importedCount++;
          if (result.isDuplicate) {
            duplicateCount++;
          }
          leads.push(result.lead);
        }
      } catch (err: any) {
        errors.push({
          row: i + 1,
          reason: err.message || 'Validation or database error',
          data: item,
        });
      }
    }

    return {
      total: items.length,
      importedCount,
      duplicateCount,
      skippedCount,
      errorCount: errors.length,
      errors,
      leads,
    };
  }

  /**
   * Previews CSV rows with column mapping and detects duplicates before import
   */
  async previewCsv(
    tenantId: string,
    rawRows: Record<string, any>[],
    columnMapping: Record<string, string>,
  ) {
    if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
      throw new BadRequestException('No CSV rows provided to preview');
    }

    // 1. Fetch existing emails and phones for this tenant for fast lookup
    const existingLeads = await this.prisma.lead.findMany({
      where: { clientId: tenantId },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true },
    });

    const emailSet = new Map<string, any>();
    const phoneSet = new Map<string, any>();

    for (const lead of existingLeads) {
      if (lead.email) emailSet.set(lead.email.toLowerCase().trim(), lead);
      if (lead.phone) phoneSet.set(lead.phone.replace(/[\s\-()]/g, ''), lead);
    }

    const mappedPreview: any[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    const errors: { row: number; error: string }[] = [];

    // Reverse mapping: crmField -> csvHeader
    const fieldToHeader: Record<string, string> = {};
    for (const [csvHeader, crmField] of Object.entries(columnMapping)) {
      if (crmField && crmField !== 'ignore') {
        fieldToHeader[crmField] = csvHeader;
      }
    }

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const getVal = (field: string) => {
        const header = fieldToHeader[field];
        if (!header) return undefined;
        const v = row[header];
        return v !== undefined && v !== null ? String(v).trim() : undefined;
      };

      const firstName = getVal('firstName');
      const lastName = getVal('lastName');
      const email = getVal('email')?.toLowerCase();
      const rawPhone = getVal('phone') || getVal('mobile');
      const phone = rawPhone ? rawPhone.replace(/[\s\-()]/g, '') : undefined;
      const company = getVal('company');
      const jobTitle = getVal('jobTitle');
      const notes = getVal('notes');
      const campaignName = getVal('campaignName') || getVal('campaign');
      const source = getVal('source') || ChannelType.CSV_IMPORT;

      const rowErrors: string[] = [];
      if (!firstName) {
        rowErrors.push('Missing First Name');
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rowErrors.push('Invalid email format');
      }

      let isDuplicate = false;
      let duplicateReason = null;
      let existingMatch = null;

      if (email && emailSet.has(email)) {
        isDuplicate = true;
        duplicateReason = 'MATCHED_EMAIL';
        existingMatch = emailSet.get(email);
      } else if (phone && phoneSet.has(phone)) {
        isDuplicate = true;
        duplicateReason = 'MATCHED_PHONE';
        existingMatch = phoneSet.get(phone);
      }

      const isValid = rowErrors.length === 0;
      if (isValid) {
        validCount++;
        if (isDuplicate) duplicateCount++;
      } else {
        invalidCount++;
        errors.push({ row: i + 1, error: rowErrors.join(', ') });
      }

      // Keep preview of first 50 rows
      if (mappedPreview.length < 50) {
        mappedPreview.push({
          _rowIndex: i + 1,
          _isValid: isValid,
          _errors: rowErrors,
          _isDuplicate: isDuplicate,
          _duplicateReason: duplicateReason,
          _matchedWith: existingMatch
            ? `${existingMatch.firstName} ${existingMatch.lastName || ''} (${existingMatch.email || existingMatch.phone})`
            : null,
          firstName: firstName || '',
          lastName: lastName || '',
          email: email || '',
          phone: phone || '',
          company: company || '',
          jobTitle: jobTitle || '',
          notes: notes || '',
          campaignName: campaignName || '',
          source,
        });
      }
    }

    return {
      totalRows: rawRows.length,
      validCount,
      invalidCount,
      duplicateCount,
      preview: mappedPreview,
      errors: errors.slice(0, 20),
    };
  }
}
