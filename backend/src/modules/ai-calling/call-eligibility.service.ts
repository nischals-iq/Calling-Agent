import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CallJobStatus } from '@prisma/client';

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
  lead?: any;
}

export interface CallingHoursConfig {
  enabled?: boolean;
  start?: string; // e.g. "09:00"
  end?: string;   // e.g. "20:00"
  timezone?: string;
}

@Injectable()
export class CallEligibilityService {
  private readonly logger = new Logger(CallEligibilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: checks if current time in the client's timezone is within permitted calling hours.
   * Default window: 09:00 to 20:00 (compliant with Indian telecom / TRAI business standards).
   * Can be configured or disabled via client.settings.callingHours.
   */
  isWithinCallingHours(
    clientTimezone = 'Asia/Kolkata',
    config?: CallingHoursConfig,
    testDate?: Date,
  ): { isPermitted: boolean; reason?: string; currentTimeStr?: string } {
    // If calling hours enforcement is explicitly disabled in settings
    if (config?.enabled === false) {
      return { isPermitted: true };
    }

    const tz = config?.timezone || clientTimezone || 'Asia/Kolkata';
    const now = testDate || new Date();

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
      const minuteStr = parts.find((p) => p.type === 'minute')?.value || '0';
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      const currentMinutes = hour * 60 + minute;

      const startTimeStr = config?.start || '09:00';
      const endTimeStr = config?.end || '20:00';

      const [startH, startM] = startTimeStr.split(':').map((v) => parseInt(v, 10) || 0);
      const [endH, endM] = endTimeStr.split(':').map((v) => parseInt(v, 10) || 0);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const currentTimeFormatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
        return {
          isPermitted: false,
          currentTimeStr: currentTimeFormatted,
          reason: `OUTSIDE_PERMITTED_CALLING_HOURS (Current: ${currentTimeFormatted} ${tz}, Window: ${startTimeStr}-${endTimeStr})`,
        };
      }

      return { isPermitted: true, currentTimeStr: currentTimeFormatted };
    } catch (err: any) {
      this.logger.warn(`Failed to evaluate calling hours for timezone "${tz}": ${err.message}`);
      // Fallback: allow to avoid total dispatch halt on invalid timezone string
      return { isPermitted: true };
    }
  }

  /**
   * Helper: verifies consent records in ai_call_consents.
   * If any consent is DENIED or WITHDRAWN -> Ineligible.
   * If client.settings.requireExplicitConsent === true, a GRANTED consent record must exist.
   */
  async verifyCallingConsent(
    clientId: string,
    leadId: string,
    leadCustomFields?: any,
    clientSettings?: any,
  ): Promise<{ isPermitted: boolean; reason?: string }> {
    // 1. Check if lead custom fields explicitly deny consent
    if (leadCustomFields && typeof leadCustomFields === 'object') {
      if (leadCustomFields.consent === false || leadCustomFields.optOut === true) {
        return { isPermitted: false, reason: 'CALLING_CONSENT_DENIED_IN_PAYLOAD' };
      }
    }

    // 2. Query ai_call_consents records for this tenant & lead
    const consentRecords = await this.prisma.aiCallConsent.findMany({
      where: { clientId, leadId },
      orderBy: { capturedAt: 'desc' },
    });

    // If an explicit denial or withdrawal exists
    const denied = consentRecords.find(
      (c) => c.consentStatus === 'DENIED' || c.consentStatus === 'WITHDRAWN',
    );
    if (denied) {
      return {
        isPermitted: false,
        reason: `CALLING_CONSENT_${denied.consentStatus}: ${denied.purpose || 'AI_VOICE_CALL'}`,
      };
    }

    // 3. If client configuration mandates explicit pre-recorded consent
    const requireExplicitConsent = Boolean(clientSettings?.requireExplicitConsent);
    if (requireExplicitConsent) {
      const granted = consentRecords.find(
        (c) =>
          c.consentStatus === 'GRANTED' &&
          (c.purpose === 'AI_VOICE_CALL' ||
            c.purpose === 'AUTOMATED_CALL' ||
            c.purpose === 'MARKETING_CALL' ||
            c.purpose === 'ALL'),
      );
      if (!granted) {
        return {
          isPermitted: false,
          reason: 'MISSING_EXPLICIT_CALLING_CONSENT (Tenant mandates explicit GRANTED consent record)',
        };
      }
    }

    return { isPermitted: true };
  }

  /**
   * Helper: checks if lead or phone is suppressed in DNC / opt-out lists.
   */
  async verifySuppression(
    clientId: string,
    leadId: string,
    phone: string,
    leadDoNotCall = false,
  ): Promise<{ isPermitted: boolean; reason?: string }> {
    // 1. Lead-level Do Not Call flag
    if (leadDoNotCall) {
      return { isPermitted: false, reason: 'LEAD_MARKED_DO_NOT_CALL' };
    }

    const trimmedPhone = phone.trim();
    const digitsOnly = trimmedPhone.replace(/\D/g, '');

    // 2. Query ai_call_suppressions for tenant
    const suppression = await this.prisma.aiCallSuppression.findFirst({
      where: {
        clientId,
        OR: [
          { phone: trimmedPhone },
          { phone: digitsOnly },
          ...(leadId ? [{ leadId }] : []),
        ],
      },
    });

    if (suppression) {
      return {
        isPermitted: false,
        reason: `DO_NOT_CALL_SUPPRESSED (Reason: ${suppression.reason || 'DNC_LIST'}, Source: ${suppression.source || 'CRM'})`,
      };
    }

    return { isPermitted: true };
  }

  /**
   * Helper: checks maximum calling attempts and retry limit.
   */
  async verifyAttemptLimit(
    clientId: string,
    leadId: string,
    clientSettings?: any,
  ): Promise<{ isPermitted: boolean; reason?: string; totalAttempts: number }> {
    const maxAttempts =
      typeof clientSettings?.maxCallAttempts === 'number'
        ? clientSettings.maxCallAttempts
        : 3;

    const existingJobs = await this.prisma.aiCallJob.findMany({
      where: { leadId, clientId },
      select: { id: true, attemptNumber: true, status: true },
    });

    const totalAttempts = existingJobs.reduce(
      (sum, j) => sum + (j.attemptNumber || 0),
      0,
    );

    if (totalAttempts >= maxAttempts) {
      return {
        isPermitted: false,
        totalAttempts,
        reason: `MAX_ATTEMPTS_EXCEEDED (${totalAttempts}/${maxAttempts} attempts reached)`,
      };
    }

    return { isPermitted: true, totalAttempts };
  }

  /**
   * Helper: checks if linked campaign is active and valid.
   */
  async verifyCampaignStatus(
    campaignId?: string | null,
  ): Promise<{ isPermitted: boolean; reason?: string }> {
    if (!campaignId) {
      // Organic or direct lead without campaign association is eligible
      return { isPermitted: true };
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { internalCampaign: true },
    });

    if (!campaign) {
      return { isPermitted: false, reason: 'CAMPAIGN_NOT_FOUND' };
    }

    if (campaign.status && campaign.status.toUpperCase() !== 'ACTIVE') {
      return {
        isPermitted: false,
        reason: `CAMPAIGN_NOT_ACTIVE (Campaign "${campaign.name}" is ${campaign.status})`,
      };
    }

    if (
      campaign.internalCampaign &&
      ['PAUSED', 'DRAFT', 'FAILED'].includes(
        campaign.internalCampaign.status?.toUpperCase() || '',
      )
    ) {
      return {
        isPermitted: false,
        reason: `INTERNAL_CAMPAIGN_NOT_ACTIVE (Status is ${campaign.internalCampaign.status})`,
      };
    }

    return { isPermitted: true };
  }

  /**
   * Evaluates if a lead is eligible for an AI outbound call job
   * Enforces all Section 4.2 validations:
   * 1. Lead exists & Client tenant match
   * 2. Valid, non-empty phone number (at least 7 digits)
   * 3. Lead stage is open (not Won/Lost)
   * 4. Do-Not-Call (DNC) and opt-out suppression
   * 5. Calling consent and permission records
   * 6. Permitted calling hours in client timezone
   * 7. Maximum calling attempts and retry limits
   * 8. Active campaign verification
   * 9. No active duplicate call job (PENDING, QUEUED, IN_PROGRESS)
   * 10. Duplicate idempotency key check
   */
  async evaluateEligibility(
    leadId: string,
    clientId: string,
    idempotencyKey: string,
    testDate?: Date,
  ): Promise<EligibilityResult> {
    // 1. Check if lead exists
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        stage: { select: { id: true, name: true, isWon: true, isLost: true } },
        client: { select: { id: true, timezone: true, settings: true, status: true } },
      },
    });

    if (!lead) {
      this.logger.warn(`Eligibility failed: Lead ${leadId} not found in database`);
      return { isEligible: false, reason: 'LEAD_NOT_FOUND' };
    }

    // 2. Tenant isolation verification
    if (lead.clientId !== clientId) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} tenant mismatch (expected ${clientId}, got ${lead.clientId})`,
      );
      return { isEligible: false, reason: 'CLIENT_TENANT_MISMATCH', lead };
    }

    // Client account active check
    if (lead.client?.status !== 'ACTIVE') {
      this.logger.warn(`Eligibility failed: Client ${clientId} is not ACTIVE`);
      return { isEligible: false, reason: 'CLIENT_ACCOUNT_INACTIVE', lead };
    }

    // 3. Valid telephone number check
    const trimmedPhone = lead.phone?.trim();
    if (!trimmedPhone || trimmedPhone.length === 0) {
      this.logger.warn(`Eligibility failed: Lead ${leadId} has no phone number`);
      return { isEligible: false, reason: 'MISSING_PHONE_NUMBER', lead };
    }

    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} phone "${trimmedPhone}" contains fewer than 7 digits`,
      );
      return { isEligible: false, reason: 'INVALID_PHONE_NUMBER_FORMAT', lead };
    }

    // 4. Closed lead exclusion check
    if (lead.stage?.isWon || lead.stage?.isLost) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} is already in closed stage "${lead.stage.name}"`,
      );
      return { isEligible: false, reason: `LEAD_ALREADY_CLOSED:${lead.stage.name}`, lead };
    }

    // 5. Do-Not-Call (DNC) and Suppression Check
    const suppressionCheck = await this.verifySuppression(
      clientId,
      lead.id,
      trimmedPhone,
      lead.doNotCall,
    );
    if (!suppressionCheck.isPermitted) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} is suppressed: ${suppressionCheck.reason}`,
      );
      return { isEligible: false, reason: suppressionCheck.reason, lead };
    }

    // 6. Calling Consent Verification
    const consentCheck = await this.verifyCallingConsent(
      clientId,
      lead.id,
      lead.customFields,
      lead.client?.settings,
    );
    if (!consentCheck.isPermitted) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} failed consent check: ${consentCheck.reason}`,
      );
      return { isEligible: false, reason: consentCheck.reason, lead };
    }

    // 7. Permitted Calling Hours Check
    const callingHoursCheck = this.isWithinCallingHours(
      lead.client?.timezone,
      (lead.client?.settings as any)?.callingHours,
      testDate,
    );
    if (!callingHoursCheck.isPermitted) {
      this.logger.warn(
        `Eligibility failed: Outside calling hours for lead ${leadId}: ${callingHoursCheck.reason}`,
      );
      return { isEligible: false, reason: callingHoursCheck.reason, lead };
    }

    // 8. Maximum Calling Attempts Check
    const attemptCheck = await this.verifyAttemptLimit(
      clientId,
      lead.id,
      lead.client?.settings,
    );
    if (!attemptCheck.isPermitted) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} exceeded attempt limit: ${attemptCheck.reason}`,
      );
      return { isEligible: false, reason: attemptCheck.reason, lead };
    }

    // 9. Campaign Active Verification
    const campaignCheck = await this.verifyCampaignStatus(lead.campaignId);
    if (!campaignCheck.isPermitted) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} associated campaign inactive: ${campaignCheck.reason}`,
      );
      return { isEligible: false, reason: campaignCheck.reason, lead };
    }

    // 10. Check if lead already has an active AI call job
    const activeJob = await this.prisma.aiCallJob.findFirst({
      where: {
        leadId,
        clientId,
        status: {
          in: [
            CallJobStatus.PENDING,
            CallJobStatus.QUEUED,
            CallJobStatus.IN_PROGRESS,
          ],
        },
      },
      select: { id: true, status: true, attemptNumber: true },
    });

    if (activeJob) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} already has an active AI call job (${activeJob.id}, status=${activeJob.status})`,
      );
      return {
        isEligible: false,
        reason: `ACTIVE_CALL_JOB_EXISTS:${activeJob.status}`,
        lead,
      };
    }

    // 11. Check if idempotency key already exists
    const existingJobWithKey = await this.prisma.aiCallJob.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true },
    });

    if (existingJobWithKey) {
      this.logger.warn(
        `Eligibility failed: Duplicate idempotency key "${idempotencyKey}" already processed (job ${existingJobWithKey.id})`,
      );
      return {
        isEligible: false,
        reason: 'DUPLICATE_IDEMPOTENCY_KEY',
        lead,
      };
    }

    this.logger.log(`Eligibility passed: Lead ${leadId} is fully eligible for AI call job`);
    return {
      isEligible: true,
      lead,
    };
  }

  /**
   * Rechecks all eligibility conditions immediately before worker processes a queued call job.
   * Ensures no conditions changed while the job was in the queue (e.g. DNC added, consent withdrawn, hours closed).
   */
  async evaluateWorkerEligibility(
    leadId: string,
    clientId: string,
    currentJobId: string,
    testDate?: Date,
  ): Promise<EligibilityResult> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        stage: { select: { id: true, name: true, isWon: true, isLost: true } },
        client: { select: { id: true, timezone: true, settings: true, status: true } },
      },
    });

    if (!lead) {
      this.logger.warn(`Worker eligibility failed: Lead ${leadId} not found`);
      return { isEligible: false, reason: 'LEAD_NOT_FOUND' };
    }

    if (lead.clientId !== clientId) {
      this.logger.warn(
        `Worker eligibility failed: Tenant mismatch for lead ${leadId} (expected ${clientId}, got ${lead.clientId})`,
      );
      return { isEligible: false, reason: 'CLIENT_TENANT_MISMATCH', lead };
    }

    if (lead.client?.status !== 'ACTIVE') {
      this.logger.warn(`Worker eligibility failed: Client ${clientId} is not ACTIVE`);
      return { isEligible: false, reason: 'CLIENT_ACCOUNT_INACTIVE', lead };
    }

    const trimmedPhone = lead.phone?.trim();
    if (!trimmedPhone || trimmedPhone.length === 0) {
      this.logger.warn(`Worker eligibility failed: Lead ${leadId} has no phone number`);
      return { isEligible: false, reason: 'MISSING_PHONE_NUMBER', lead };
    }

    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      this.logger.warn(
        `Worker eligibility failed: Lead ${leadId} phone "${trimmedPhone}" invalid format`,
      );
      return { isEligible: false, reason: 'INVALID_PHONE_NUMBER_FORMAT', lead };
    }

    // Lead stage closed check
    if (lead.stage?.isWon || lead.stage?.isLost) {
      this.logger.warn(`Worker eligibility failed: Lead ${leadId} is closed`);
      return { isEligible: false, reason: `LEAD_ALREADY_CLOSED:${lead.stage.name}`, lead };
    }

    // DNC & Suppression check
    const suppressionCheck = await this.verifySuppression(
      clientId,
      lead.id,
      trimmedPhone,
      lead.doNotCall,
    );
    if (!suppressionCheck.isPermitted) {
      this.logger.warn(
        `Worker eligibility failed: Lead ${leadId} is suppressed: ${suppressionCheck.reason}`,
      );
      return { isEligible: false, reason: suppressionCheck.reason, lead };
    }

    // Consent check
    const consentCheck = await this.verifyCallingConsent(
      clientId,
      lead.id,
      lead.customFields,
      lead.client?.settings,
    );
    if (!consentCheck.isPermitted) {
      this.logger.warn(
        `Worker eligibility failed: Lead ${leadId} consent check failed: ${consentCheck.reason}`,
      );
      return { isEligible: false, reason: consentCheck.reason, lead };
    }

    // Permitted Calling Hours check
    const callingHoursCheck = this.isWithinCallingHours(
      lead.client?.timezone,
      (lead.client?.settings as any)?.callingHours,
      testDate,
    );
    if (!callingHoursCheck.isPermitted) {
      this.logger.warn(
        `Worker eligibility failed: Outside calling hours for lead ${leadId}: ${callingHoursCheck.reason}`,
      );
      return { isEligible: false, reason: callingHoursCheck.reason, lead };
    }

    // Maximum attempts check
    const attemptCheck = await this.verifyAttemptLimit(
      clientId,
      lead.id,
      lead.client?.settings,
    );
    if (!attemptCheck.isPermitted) {
      this.logger.warn(
        `Worker eligibility failed: Lead ${leadId} exceeded attempt limit: ${attemptCheck.reason}`,
      );
      return { isEligible: false, reason: attemptCheck.reason, lead };
    }

    // Campaign active check
    const campaignCheck = await this.verifyCampaignStatus(lead.campaignId);
    if (!campaignCheck.isPermitted) {
      this.logger.warn(
        `Worker eligibility failed: Campaign inactive: ${campaignCheck.reason}`,
      );
      return { isEligible: false, reason: campaignCheck.reason, lead };
    }

    // Check if another job for this lead is already IN_PROGRESS
    const concurrentJob = await this.prisma.aiCallJob.findFirst({
      where: {
        leadId,
        clientId,
        id: { not: currentJobId },
        status: CallJobStatus.IN_PROGRESS,
      },
      select: { id: true, status: true },
    });

    if (concurrentJob) {
      this.logger.warn(
        `Worker eligibility failed: Lead ${leadId} has another call job in progress (${concurrentJob.id})`,
      );
      return { isEligible: false, reason: 'CONCURRENT_JOB_IN_PROGRESS', lead };
    }

    return { isEligible: true, lead };
  }

  /**
   * Helper: records consent for a lead.
   */
  async recordConsent(
    clientId: string,
    leadId: string,
    data: {
      purpose?: string;
      consentStatus?: string;
      source?: string;
      evidenceReference?: string;
      notes?: string;
    },
  ) {
    return this.prisma.aiCallConsent.create({
      data: {
        clientId,
        leadId,
        purpose: data.purpose || 'AI_VOICE_CALL',
        consentStatus: data.consentStatus || 'GRANTED',
        source: data.source || 'CRM_MANUAL',
        evidenceReference: data.evidenceReference,
        notes: data.notes,
      },
    });
  }

  /**
   * Helper: adds a phone/lead to the suppression list.
   */
  async recordSuppression(
    clientId: string,
    data: {
      phone: string;
      leadId?: string;
      reason: string;
      source?: string;
      notes?: string;
    },
  ) {
    const trimmedPhone = data.phone.trim();
    if (data.leadId) {
      await this.prisma.lead.update({
        where: { id: data.leadId },
        data: { doNotCall: true },
      });
    }

    return this.prisma.aiCallSuppression.create({
      data: {
        clientId,
        leadId: data.leadId,
        phone: trimmedPhone,
        reason: data.reason,
        source: data.source || 'CRM_MANUAL',
        notes: data.notes,
      },
    });
  }
}
