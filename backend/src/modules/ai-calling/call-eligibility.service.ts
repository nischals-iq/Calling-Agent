import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CallJobStatus } from '@prisma/client';

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
  lead?: any;
}

@Injectable()
export class CallEligibilityService {
  private readonly logger = new Logger(CallEligibilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates if a lead is eligible for an AI outbound call job
   * Initial checks:
   * 1. Lead exists in database
   * 2. Lead belongs to the specified tenant (clientId matches)
   * 3. Lead has a valid, non-empty phone number
   * 4. Lead is not already associated with an active AI call job (PENDING, QUEUED, IN_PROGRESS)
   * 5. No duplicate idempotency key exists
   */
  async evaluateEligibility(
    leadId: string,
    clientId: string,
    idempotencyKey: string,
  ): Promise<EligibilityResult> {
    // 1. Check if lead exists
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        stage: { select: { id: true, name: true, isWon: true, isLost: true } },
      },
    });

    if (!lead) {
      this.logger.warn(`Eligibility failed: Lead ${leadId} not found in database`);
      return {
        isEligible: false,
        reason: 'LEAD_NOT_FOUND',
      };
    }

    // 2. Check if clientId matches (tenant isolation verification)
    if (lead.clientId !== clientId) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} tenant mismatch (expected ${clientId}, got ${lead.clientId})`,
      );
      return {
        isEligible: false,
        reason: 'CLIENT_TENANT_MISMATCH',
        lead,
      };
    }

    // 3. Check for valid, non-empty phone number
    const trimmedPhone = lead.phone?.trim();
    if (!trimmedPhone || trimmedPhone.length === 0) {
      this.logger.warn(`Eligibility failed: Lead ${leadId} has no phone number`);
      return {
        isEligible: false,
        reason: 'MISSING_PHONE_NUMBER',
        lead,
      };
    }

    // Basic digit validation: phone must contain at least 7 digits
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      this.logger.warn(
        `Eligibility failed: Lead ${leadId} phone "${trimmedPhone}" contains fewer than 7 digits`,
      );
      return {
        isEligible: false,
        reason: 'INVALID_PHONE_NUMBER_FORMAT',
        lead,
      };
    }

    // 4. Check if lead is already associated with an active AI call job
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

    // 5. Check if idempotency key already exists
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

    this.logger.log(`Eligibility passed: Lead ${leadId} is eligible for AI call job`);
    return {
      isEligible: true,
      lead,
    };
  }

  /**
   * Rechecks eligibility immediately before worker processes a queued call job.
   * Ensures:
   * 1. Lead still exists in DB
   * 2. Tenant isolation is maintained
   * 3. Valid phone number still present
   * 4. No conflicting active job in progress
   */
  async evaluateWorkerEligibility(
    leadId: string,
    clientId: string,
    currentJobId: string,
  ): Promise<EligibilityResult> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        stage: { select: { id: true, name: true, isWon: true, isLost: true } },
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

    const trimmedPhone = lead.phone?.trim();
    if (!trimmedPhone || trimmedPhone.length === 0) {
      this.logger.warn(`Worker eligibility failed: Lead ${leadId} has no phone number`);
      return { isEligible: false, reason: 'MISSING_PHONE_NUMBER', lead };
    }

    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      this.logger.warn(`Worker eligibility failed: Lead ${leadId} phone "${trimmedPhone}" invalid format`);
      return { isEligible: false, reason: 'INVALID_PHONE_NUMBER_FORMAT', lead };
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
}
