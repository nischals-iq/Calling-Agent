import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { CallEligibilityService } from '../call-eligibility.service.js';
import { MockTelephonyAdapter } from '../adapters/mock-telephony.adapter.js';
import { TelephonyProviderService } from '../adapters/telephony-provider.service.js';
import { CallRetryService } from '../call-retry.service.js';
import { AI_CALLING_QUEUE, DispatchJobPayload } from '../call-queue.service.js';
import { CallJobStatus } from '@prisma/client';

@Processor(AI_CALLING_QUEUE)
export class AiCallingWorker extends WorkerHost {
  private readonly logger = new Logger(AiCallingWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibilityService: CallEligibilityService,
    private readonly providerService: TelephonyProviderService,
    private readonly mockTelephony: MockTelephonyAdapter,
    private readonly retryService: CallRetryService,
  ) {
    super();
  }

  /**
   * BullMQ Worker process handler for AI Call Jobs
   * Orchestrates the call session lifecycle and handles failure/retry evaluation.
   */
  async process(job: Job<DispatchJobPayload>): Promise<any> {
    const { callJobId, leadId, clientId } = job.data;
    this.logger.log(
      `[WORKER] Picked up job ${job.id} for callJobId=${callJobId}, leadId=${leadId}, tenant=${clientId}`,
    );

    try {
      // 1. Load AiCallJob and related Lead from Database
      const callJob = await this.prisma.aiCallJob.findUnique({
        where: { id: callJobId },
        include: { lead: true },
      });

      if (!callJob) {
        this.logger.warn(`[WORKER] Call job ${callJobId} not found in database. Skipping.`);
        return { success: false, reason: 'JOB_NOT_FOUND' };
      }

      // Check if job was already processed or cancelled
      if (
        callJob.status === CallJobStatus.COMPLETED ||
        callJob.status === CallJobStatus.CANCELLED
      ) {
        this.logger.warn(
          `[WORKER] Call job ${callJobId} already reached terminal state: ${callJob.status}`,
        );
        return { success: true, status: callJob.status };
      }

      // 2. Tenant isolation verification
      if (callJob.clientId !== clientId || callJob.lead?.clientId !== clientId) {
        this.logger.error(
          `[WORKER] Tenant mismatch for job ${callJobId}! job.clientId=${callJob.clientId}, lead.clientId=${callJob.lead?.clientId}, expected=${clientId}`,
        );
        await this.prisma.aiCallJob.update({
          where: { id: callJobId },
          data: {
            status: CallJobStatus.FAILED,
            failedAt: new Date(),
            lastError: 'CLIENT_TENANT_MISMATCH',
          },
        });
        return { success: false, reason: 'CLIENT_TENANT_MISMATCH' };
      }

      // 3. Recheck Module 4.2 eligibility before processing
      const eligibility = await this.eligibilityService.evaluateWorkerEligibility(
        leadId,
        clientId,
        callJobId,
      );

      if (!eligibility.isEligible) {
        this.logger.warn(
          `[WORKER] Eligibility recheck FAILED for lead ${leadId}: ${eligibility.reason}`,
        );
        await this.prisma.aiCallJob.update({
          where: { id: callJobId },
          data: {
            status: CallJobStatus.FAILED,
            failedAt: new Date(),
            lastError: `Eligibility recheck failed: ${eligibility.reason}`,
          },
        });
        return { success: false, reason: eligibility.reason };
      }

      // 4. Update status: QUEUED -> IN_PROGRESS & increment attempt counter
      await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.IN_PROGRESS,
          attemptNumber: { increment: 1 },
          startedAt: new Date(),
        },
      });

      this.logger.log(
        `[WORKER] Call job ${callJobId} transitioned: QUEUED -> IN_PROGRESS (attempt #${callJob.attemptNumber + 1})`,
      );

      // 5. Select telephony provider (MOCK_TELEPHONY or EXOTEL)
      const requestedProvider = (callJob.metadata as any)?.provider;
      const provider = this.providerService.getProvider(requestedProvider);

      this.logger.log(
        `[WORKER] Initiating call for job ${callJobId} via provider "${provider.name}" (simulated: ${provider.isSimulated})`,
      );

      const callInit = await provider.initiateCall({
        clientId,
        leadId,
        callJobId,
        phone: callJob.lead?.phone || '',
        languageUsed: callJob.lead?.preferredLanguage || 'en',
        metadata: {
          jobAttempt: callJob.attemptNumber + 1,
        },
      });

      // 6. Provider-specific progression handling:
      if (provider.isSimulated) {
        const targetOutcome =
          (callJob.metadata as any)?.simulateOutcome || 'COMPLETED';

        const sessionResult = await this.mockTelephony.simulateProgression(
          callInit.providerCallId,
          targetOutcome,
        );

        // 7. Coordinate job status & retries based on session outcome
        const session = sessionResult.session!;
        const retryEval = await this.retryService.handleCallOutcome(
          callJobId,
          session.status,
          session.outcome || session.status,
          (callJob.metadata as any)?.testRetryDelayMs,
        );

        return {
          success: true,
          callJobId,
          provider: provider.name,
          sessionStatus: session.status,
          outcome: session.outcome,
          retryScheduled: retryEval.retryScheduled,
        };
      }

      // If provider is a real carrier (e.g. EXOTEL):
      // The call is now INITIATED on the carrier.
      // Crucial: Do NOT mark COMPLETED! The job remains in IN_PROGRESS awaiting StatusCallback webhooks.
      this.logger.log(
        `[WORKER] Outbound call placed via ${provider.name}. Sid: ${callInit.providerCallId}. Job ${callJobId} remains IN_PROGRESS awaiting carrier callbacks.`,
      );

      return {
        success: true,
        callJobId,
        provider: provider.name,
        providerCallId: callInit.providerCallId,
        status: CallJobStatus.IN_PROGRESS,
        waitingForWebhook: true,
      };
    } catch (err: any) {
      this.logger.error(
        `[WORKER] Unhandled error during processing of job ${callJobId}: ${err.message}`,
        err.stack,
      );

      // Handle worker error safely without crashing the worker process
      try {
        await this.prisma.aiCallJob.update({
          where: { id: callJobId },
          data: {
            status: CallJobStatus.FAILED,
            failedAt: new Date(),
            lastError: `Worker execution exception: ${err.message}`,
          },
        });
      } catch (dbErr: any) {
        this.logger.error(
          `[WORKER] Failed to persist FAILED status for job ${callJobId}: ${dbErr.message}`,
        );
      }

      return { success: false, error: err.message };
    }
  }
}
