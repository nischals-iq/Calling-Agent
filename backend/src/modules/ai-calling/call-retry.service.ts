import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CallQueueService } from './call-queue.service.js';
import { CallEligibilityService } from './call-eligibility.service.js';
import { CallJobStatus, TelephonyStatus } from '@prisma/client';

export interface RetryEvaluationResult {
  retryScheduled: boolean;
  reason?: string;
  nextScheduledAt?: Date;
  attemptNumber?: number;
  maxAttempts?: number;
}

@Injectable()
export class CallRetryService {
  private readonly logger = new Logger(CallRetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: CallQueueService,
    private readonly eligibilityService: CallEligibilityService,
  ) {}

  /**
   * Determines if a call failure outcome is retryable according to Section 13 rules.
   */
  isRetryableOutcome(outcome: string | TelephonyStatus): boolean {
    const outcomeUpper = outcome.toString().toUpperCase();
    // Outcomes that qualify for retries
    const retryableList = [
      'BUSY',
      'NO_ANSWER',
      'NO_RESPONSE',
      'NETWORK_FAILURE',
      'PROVIDER_FAILURE',
      'TEMPORARY_ERROR',
      'LINE_BUSY',
      'FAILED',
    ];
    return retryableList.includes(outcomeUpper);
  }

  /**
   * Evaluates a completed/failed call session and schedules a retry if eligible.
   */
  async handleCallOutcome(
    callJobId: string,
    telephonyStatus: TelephonyStatus,
    outcome: string,
    customRetryDelayMs?: number,
  ): Promise<RetryEvaluationResult> {
    this.logger.log(
      `Evaluating call outcome for job ${callJobId}: status=${telephonyStatus}, outcome=${outcome}`,
    );

    // 1. Load job, lead, and client
    const job = await this.prisma.aiCallJob.findUnique({
      where: { id: callJobId },
      include: {
        lead: true,
        client: { select: { id: true, timezone: true, settings: true } },
      },
    });

    if (!job) {
      this.logger.warn(`Cannot evaluate retry: Call job ${callJobId} not found`);
      return { retryScheduled: false, reason: 'JOB_NOT_FOUND' };
    }

    // 2. Successful connection handling
    if (telephonyStatus === TelephonyStatus.COMPLETED) {
      this.logger.log(`Call job ${callJobId} completed successfully. No retry needed.`);
      await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.COMPLETED,
          completedAt: new Date(),
          metadata: {
            ...((job.metadata as Record<string, any>) || {}),
            finalOutcome: outcome,
            telephonyStatus,
          },
        },
      });
      return { retryScheduled: false, reason: 'CALL_COMPLETED' };
    }

    // 3. Non-retryable check
    if (!this.isRetryableOutcome(telephonyStatus) && !this.isRetryableOutcome(outcome)) {
      this.logger.warn(
        `Non-retryable outcome for job ${callJobId}: outcome=${outcome}. Marking FAILED.`,
      );
      await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.FAILED,
          failedAt: new Date(),
          lastError: `Non-retryable call outcome: ${outcome}`,
        },
      });
      return { retryScheduled: false, reason: `NON_RETRYABLE_OUTCOME:${outcome}` };
    }

    // 4. Opt-out & Suppression check: Never retry if lead is suppressed or opted out
    const suppressionCheck = await this.eligibilityService.verifySuppression(
      job.clientId,
      job.leadId,
      job.lead?.phone || '',
      job.lead?.doNotCall,
    );

    if (!suppressionCheck.isPermitted) {
      this.logger.warn(
        `Automated retry aborted: Lead ${job.leadId} is suppressed (${suppressionCheck.reason})`,
      );
      await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.FAILED,
          failedAt: new Date(),
          lastError: `Retry blocked: ${suppressionCheck.reason}`,
        },
      });
      return { retryScheduled: false, reason: suppressionCheck.reason };
    }

    // 5. Consent check
    const consentCheck = await this.eligibilityService.verifyCallingConsent(
      job.clientId,
      job.leadId,
      job.lead?.customFields,
      job.client?.settings,
    );

    if (!consentCheck.isPermitted) {
      this.logger.warn(
        `Automated retry aborted: Lead ${job.leadId} consent check failed (${consentCheck.reason})`,
      );
      await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.FAILED,
          failedAt: new Date(),
          lastError: `Retry blocked: ${consentCheck.reason}`,
        },
      });
      return { retryScheduled: false, reason: consentCheck.reason };
    }

    // 6. Max attempt limit enforcement
    const clientSettings: any = job.client?.settings || {};
    const maxAttempts =
      typeof clientSettings.maxCallAttempts === 'number' ? clientSettings.maxCallAttempts : 3;

    if (job.attemptNumber >= maxAttempts) {
      this.logger.warn(
        `Retry limit reached for job ${callJobId}: ${job.attemptNumber}/${maxAttempts} attempts.`,
      );
      await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.FAILED,
          failedAt: new Date(),
          lastError: `MAX_ATTEMPTS_EXCEEDED: Maximum call attempts (${job.attemptNumber}/${maxAttempts}) reached`,
        },
      });
      return {
        retryScheduled: false,
        reason: 'MAX_ATTEMPTS_EXCEEDED',
        attemptNumber: job.attemptNumber,
        maxAttempts,
      };
    }

    // 7. Calculate retry delay
    // Default: 15 minutes, or configured in client settings, or custom override (e.g. for testing)
    const retryDelayMs =
      customRetryDelayMs !== undefined
        ? customRetryDelayMs
        : typeof clientSettings.retryDelayMs === 'number'
          ? clientSettings.retryDelayMs
          : 15 * 60 * 1000; // 15 mins default

    const nextScheduledAt = new Date(Date.now() + retryDelayMs);

    // 8. Update job status to QUEUED with next scheduled timestamp
    await this.prisma.aiCallJob.update({
      where: { id: callJobId },
      data: {
        status: CallJobStatus.QUEUED,
        scheduledAt: nextScheduledAt,
        queuedAt: new Date(),
        metadata: {
          ...((job.metadata as Record<string, any>) || {}),
          retryCount: (job.attemptNumber || 0),
          lastFailureReason: outcome,
          retryScheduled: true,
          nextScheduledAt: nextScheduledAt.toISOString(),
        },
      },
    });

    // 9. Re-enqueue in BullMQ queue with delay
    await this.queueService.enqueueCallJob(
      job.id,
      job.leadId,
      job.clientId,
      job.priority,
    );

    this.logger.log(
      `Scheduled retry for job ${callJobId} in ${retryDelayMs / 1000}s (at ${nextScheduledAt.toISOString()}). Attempt #${job.attemptNumber + 1}`,
    );

    return {
      retryScheduled: true,
      nextScheduledAt,
      attemptNumber: job.attemptNumber,
      maxAttempts,
    };
  }
}
