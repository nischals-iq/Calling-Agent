import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { ChannelType, IntegrationStatus } from '@prisma/client';
import { IngestLeadPayload } from '../../lead-capture/dto/lead-ingestion-payload.dto.js';

export interface NormalizedLeadResult {
  leadPayload: IngestLeadPayload;
  campaignId?: string;
  providerEventId?: string;
}

@Injectable()
export class IntegrationNormalizerService {
  private readonly logger = new Logger(IntegrationNormalizerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves or auto-creates a Campaign record based on external provider metadata.
   */
  async resolveOrCreateCampaign(
    clientId: string,
    source: ChannelType,
    metadata: {
      platformCampaignId?: string | null;
      campaignName?: string | null;
      spend?: number;
      budget?: number;
      integrationId?: string | null;
    },
  ): Promise<string | null> {
    if (!metadata.platformCampaignId && !metadata.campaignName) {
      return null;
    }

    try {
      // 1. Try finding by platformCampaignId first
      if (metadata.platformCampaignId) {
        const existing = await this.prisma.campaign.findFirst({
          where: {
            clientId,
            source,
            platformCampaignId: metadata.platformCampaignId,
          },
        });

        if (existing) {
          // If name or spend provided and needs update
          if (metadata.campaignName && existing.name !== metadata.campaignName) {
            await this.prisma.campaign.update({
              where: { id: existing.id },
              data: {
                name: metadata.campaignName,
                spend: metadata.spend !== undefined ? metadata.spend : existing.spend,
              },
            });
          }
          return existing.id;
        }
      }

      // 2. Try finding by name if no platformCampaignId match
      if (metadata.campaignName) {
        const existingByName = await this.prisma.campaign.findFirst({
          where: {
            clientId,
            source,
            name: metadata.campaignName,
          },
        });

        if (existingByName) {
          if (metadata.platformCampaignId && !existingByName.platformCampaignId) {
            await this.prisma.campaign.update({
              where: { id: existingByName.id },
              data: { platformCampaignId: metadata.platformCampaignId },
            });
          }
          return existingByName.id;
        }
      }

      // 3. Create new Campaign record if not found
      const newCampaignName = metadata.campaignName || `Campaign ${metadata.platformCampaignId}`;
      const created = await this.prisma.campaign.create({
        data: {
          clientId,
          integrationId: metadata.integrationId || null,
          name: newCampaignName,
          source,
          platformCampaignId: metadata.platformCampaignId || null,
          status: 'ACTIVE',
          spend: metadata.spend || 0,
          budget: metadata.budget || null,
        },
      });

      this.logger.log(`Auto-created campaign [${created.id}] "${newCampaignName}" for client ${clientId}`);
      return created.id;
    } catch (err: any) {
      this.logger.warn(`Failed to resolve/create campaign: ${err.message}`);
      return null;
    }
  }

  /**
   * Checks if an incoming webhook event was already recorded and processed (Idempotency check).
   */
  async checkWebhookIdempotency(channel: ChannelType, providerEventId?: string | null): Promise<boolean> {
    if (!providerEventId) return false;

    const existingLog = await this.prisma.webhookLog.findFirst({
      where: {
        channel,
        status: 'PROCESSED',
        payload: {
          path: ['providerEventId'],
          equals: providerEventId,
        },
      },
    });

    return !!existingLog;
  }

  /**
   * Normalizes Meta Lead Ads payload
   */
  normalizeMetaPayload(raw: any): {
    payload: IngestLeadPayload;
    providerEventId?: string;
    platformCampaignId?: string;
    campaignName?: string;
  } {
    // Meta leadgen structure: field_data: [{ name: 'first_name', values: ['John'] }, ...]
    const fieldMap: Record<string, string> = {};
    const fieldData = raw.field_data || raw.fieldData || [];

    if (Array.isArray(fieldData)) {
      for (const item of fieldData) {
        const key = (item.name || '').toLowerCase();
        const val = Array.isArray(item.values) ? item.values[0] : item.values;
        if (key && val) fieldMap[key] = String(val).trim();
      }
    }

    const firstName =
      fieldMap['first_name'] ||
      fieldMap['firstname'] ||
      (fieldMap['full_name'] ? fieldMap['full_name'].split(' ')[0] : '') ||
      raw.firstName ||
      raw.name?.split(' ')[0] ||
      'Meta Lead';

    const lastName =
      fieldMap['last_name'] ||
      fieldMap['lastname'] ||
      (fieldMap['full_name'] ? fieldMap['full_name'].split(' ').slice(1).join(' ') : '') ||
      raw.lastName ||
      (raw.name && raw.name.includes(' ') ? raw.name.split(' ').slice(1).join(' ') : undefined);

    const email = fieldMap['email'] || raw.email || undefined;
    const phone = fieldMap['phone_number'] || fieldMap['phone'] || fieldMap['mobile'] || raw.phone || undefined;
    const company = fieldMap['company_name'] || fieldMap['company'] || raw.company || undefined;
    const jobTitle = fieldMap['job_title'] || fieldMap['title'] || raw.jobTitle || undefined;

    const campaignName = raw.campaign_name || raw.campaignName || fieldMap['campaign_name'] || undefined;
    const platformCampaignId = raw.campaign_id || raw.campaignId || undefined;
    const adSetId = raw.adset_id || raw.adSetId || undefined;
    const adId = raw.ad_id || raw.adId || undefined;
    const formId = raw.form_id || raw.formId || undefined;
    const providerEventId = raw.leadgen_id || raw.id || raw.event_id || undefined;

    const payload: IngestLeadPayload = {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      source: ChannelType.META,
      medium: 'cpc',
      campaignName,
      campaignId: platformCampaignId,
      adSetId,
      adId,
      formId,
      utmSource: 'facebook',
      utmMedium: 'paid_social',
      utmCampaign: campaignName,
      notes: raw.notes || `Captured via Meta Lead Ad (Form ID: ${formId || 'N/A'})`,
      customFields: {
        rawMetaFields: fieldMap,
        createdTime: raw.created_time || new Date().toISOString(),
        pageId: raw.page_id || raw.pageId,
      },
    };

    return { payload, providerEventId, platformCampaignId, campaignName };
  }

  /**
   * Normalizes Google Ads Lead payload
   */
  normalizeGooglePayload(raw: any): {
    payload: IngestLeadPayload;
    providerEventId?: string;
    platformCampaignId?: string;
    campaignName?: string;
  } {
    // Google lead form webhook structure: user_column_data: [{ column_id: 'FIRST_NAME', string_value: 'Jane' }, ...]
    const colMap: Record<string, string> = {};
    const userColumns = raw.user_column_data || raw.userColumnData || [];

    if (Array.isArray(userColumns)) {
      for (const col of userColumns) {
        const id = (col.column_id || col.columnId || '').toUpperCase();
        const val = col.string_value || col.stringValue;
        if (id && val) colMap[id] = String(val).trim();
      }
    }

    const firstName =
      colMap['FIRST_NAME'] ||
      (colMap['FULL_NAME'] ? colMap['FULL_NAME'].split(' ')[0] : '') ||
      raw.firstName ||
      raw.name?.split(' ')[0] ||
      'Google Lead';

    const lastName =
      colMap['LAST_NAME'] ||
      (colMap['FULL_NAME'] ? colMap['FULL_NAME'].split(' ').slice(1).join(' ') : '') ||
      raw.lastName ||
      (raw.name && raw.name.includes(' ') ? raw.name.split(' ').slice(1).join(' ') : undefined);

    const email = colMap['EMAIL'] || raw.email || undefined;
    const phone = colMap['PHONE_NUMBER'] || raw.phone || undefined;
    const company = colMap['COMPANY_NAME'] || raw.company || undefined;

    const platformCampaignId = raw.campaign_id ? String(raw.campaign_id) : raw.campaignId;
    const campaignName = raw.campaign_name || raw.campaignName || undefined;
    const adId = raw.creative_id ? String(raw.creative_id) : raw.adId;
    const adSetId = raw.adgroup_id ? String(raw.adgroup_id) : raw.adgroupId || raw.adSetId;
    const formId = raw.form_id ? String(raw.form_id) : raw.formId;
    const gclid = raw.gcl_id || raw.gclid || undefined;
    const providerEventId = raw.lead_id || raw.leadId || gclid || undefined;

    const payload: IngestLeadPayload = {
      firstName,
      lastName,
      email,
      phone,
      company,
      source: ChannelType.GOOGLE,
      medium: 'cpc',
      campaignName,
      campaignId: platformCampaignId,
      adSetId,
      adId,
      formId,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: campaignName,
      notes: raw.notes || (raw.is_test ? 'Google Ads Test Lead' : `Captured via Google Ads Lead Form (GCLID: ${gclid || 'N/A'})`),
      customFields: {
        gclid,
        rawGoogleColumns: colMap,
        googleKey: raw.google_key || raw.googleKey || raw.key,
        adgroupId: raw.adgroup_id ? String(raw.adgroup_id) : raw.adgroupId,
        creativeId: raw.creative_id ? String(raw.creative_id) : raw.creativeId,
        apiVersion: raw.api_version || raw.apiVersion,
        isTest: Boolean(raw.is_test ?? raw.isTest),
        googleLeadId: raw.lead_id || raw.leadId || undefined,
        googleTestLead: Boolean(raw.is_test ?? raw.isTest),
      },
    };

    return { payload, providerEventId, platformCampaignId, campaignName };
  }

  /**
   * Normalizes LinkedIn Lead Gen Form payload
   */
  normalizeLinkedinPayload(raw: any): {
    payload: IngestLeadPayload;
    providerEventId?: string;
    platformCampaignId?: string;
    campaignName?: string;
  } {
    // LinkedIn Lead Gen structure: answers: [{ questionId: 'firstName', value: 'Alice' }, ...]
    const ansMap: Record<string, string> = {};
    const answers = raw.answers || raw.formAnswers || [];

    if (Array.isArray(answers)) {
      for (const ans of answers) {
        const qId = (ans.questionId || ans.question_id || '').toLowerCase();
        const val = ans.value || ans.answer;
        if (qId && val) ansMap[qId] = String(val).trim();
      }
    }

    const firstName =
      ansMap['firstname'] ||
      ansMap['first_name'] ||
      raw.firstName ||
      raw.name?.split(' ')[0] ||
      'LinkedIn Lead';

    const lastName =
      ansMap['lastname'] ||
      ansMap['last_name'] ||
      raw.lastName ||
      (raw.name && raw.name.includes(' ') ? raw.name.split(' ').slice(1).join(' ') : undefined);

    const email = ansMap['email'] || ansMap['email_address'] || raw.email || undefined;
    const phone = ansMap['phone'] || ansMap['phone_number'] || raw.phone || undefined;
    const company = ansMap['company'] || ansMap['company_name'] || raw.company || undefined;
    const jobTitle = ansMap['job_title'] || ansMap['title'] || raw.jobTitle || undefined;

    const platformCampaignId = raw.campaign_id || raw.campaignId ? String(raw.campaign_id || raw.campaignId) : undefined;
    const campaignName = raw.campaign_name || raw.campaignName || undefined;
    const formId = raw.form_id || raw.formId ? String(raw.form_id || raw.formId) : undefined;
    const providerEventId = raw.lead_id || raw.leadId || raw.submission_id || undefined;

    const payload: IngestLeadPayload = {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      source: ChannelType.LINKEDIN,
      medium: 'paid_social',
      campaignName,
      campaignId: platformCampaignId,
      formId,
      utmSource: 'linkedin',
      utmMedium: 'paid_social',
      utmCampaign: campaignName,
      notes: raw.notes || `Captured via LinkedIn Lead Gen Form (Form ID: ${formId || 'N/A'})`,
      customFields: {
        rawLinkedinAnswers: ansMap,
        organizationId: raw.organization_id || raw.organizationId,
      },
    };

    return { payload, providerEventId, platformCampaignId, campaignName };
  }
}
