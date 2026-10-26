import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { CallEligibilityService } from '../call-eligibility.service.js';
import { AI_CALLING_QUEUE, DispatchJobPayload } from '../call-queue.service.js';
import { CallJobStatus } from '@prisma/client';

@Processor(AI_CALLING_QUEUE)
export class AiCallingWorker extends WorkerHost {
  private readonly logger = new Logger(AiCallingWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibilityService: CallEligibilityService,
  ) {
    super();
  }

  /**
   * BullMQ Worker process handler for AI Call Jobs
   * Handles full lifecycle: QUEUED -> IN_PROGRESS -> COMPLETED (or FAILED)
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

      // 3. Recheck eligibility before processing
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

      // 5. Observable simulation delay (4 seconds) so IN_PROGRESS state is visible in testing/monitoring
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // 6. Transition to COMPLETED with metadata recording simulated outcome
      const completedJob = await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.COMPLETED,
          completedAt: new Date(),
          metadata: {
            ...((callJob.metadata as Record<string, any>) || {}),
            simulatedExecution: {
              outcome: 'CALL_COMPLETED_SUCCESSFULLY',
              leadPhone: callJob.lead?.phone,
              durationSeconds: 4,
              dispatchedAt: new Date().toISOString(),
              telephonyReady: false,
              mode: 'SIMULATION_FOUNDATION',
            },
          },
        },
      });

      this.logger.log(
        `[WORKER] Call job ${callJobId} successfully processed: IN_PROGRESS -> COMPLETED`,
      );

      return {
        success: true,
        callJobId: completedJob.id,
        status: completedJob.status,
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
