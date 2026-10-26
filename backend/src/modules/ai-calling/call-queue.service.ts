import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CallJobPriority, CallJobStatus } from '@prisma/client';

export interface DispatchJobPayload {
  callJobId: string;
  leadId: string;
  clientId: string;
}

export const AI_CALLING_QUEUE = 'ai-calling-dispatch';

@Injectable()
export class CallQueueService {
  private readonly logger = new Logger(CallQueueService.name);

  constructor(
    @InjectQueue(AI_CALLING_QUEUE) private readonly callQueue: Queue<DispatchJobPayload>,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueues an existing PENDING AiCallJob into BullMQ.
   * Updates database status: PENDING -> QUEUED with queuedAt timestamp.
   * Uses 2000ms delay to ensure QUEUED status is observable during verification.
   */
  async enqueueCallJob(
    callJobId: string,
    leadId: string,
    clientId: string,
    priority: CallJobPriority = CallJobPriority.HIGH,
  ): Promise<void> {
    try {
      // 1. Enqueue in BullMQ with deterministic jobId matching callJobId (enforces queue-level deduplication)
      const bullPriority =
        priority === CallJobPriority.URGENT ? 1 : priority === CallJobPriority.HIGH ? 2 : 3;

      await this.callQueue.add(
        'dispatch-call',
        { callJobId, leadId, clientId },
        {
          jobId: callJobId,
          delay: 2000, // Observable delay for status verification
          priority: bullPriority,
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );

      // 2. Transition DB state: PENDING -> QUEUED
      await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.QUEUED,
          queuedAt: new Date(),
        },
      });

      this.logger.log(
        `[QUEUE] Enqueued call job ${callJobId} for lead ${leadId} (status: PENDING -> QUEUED, delay: 2000ms)`,
      );
    } catch (err: any) {
      this.logger.error(
        `[QUEUE] Failed to enqueue call job ${callJobId}: ${err.message}`,
        err.stack,
      );
      await this.prisma.aiCallJob.update({
        where: { id: callJobId },
        data: {
          status: CallJobStatus.FAILED,
          failedAt: new Date(),
          lastError: `Queue insertion failed: ${err.message}`,
        },
      });
    }
  }
}
