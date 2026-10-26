import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LeadCreatedEvent } from '../../lead-capture/events/lead-created.event.js';
import { CallEligibilityService } from '../call-eligibility.service.js';
import { CallJobsService } from '../call-jobs.service.js';
import { CallQueueService } from '../call-queue.service.js';
import { CallJobPriority } from '@prisma/client';

@Injectable()
export class LeadCreatedListener {
  private readonly logger = new Logger(LeadCreatedListener.name);

  constructor(
    private readonly eligibilityService: CallEligibilityService,
    private readonly callJobsService: CallJobsService,
    private readonly callQueueService: CallQueueService,
  ) {}

  @OnEvent('lead.created', { async: true })
  async handleLeadCreated(event: LeadCreatedEvent) {
    this.logger.log(
      `Received lead.created event: leadId=${event.leadId}, clientId=${event.clientId}, source=${event.source}, eventId=${event.eventId}`,
    );

    const idempotencyKey = `lead-created:${event.leadId}`;

    try {
      // 1. Evaluate lead calling eligibility
      const eligibility = await this.eligibilityService.evaluateEligibility(
        event.leadId,
        event.clientId,
        idempotencyKey,
      );

      // 2. If not eligible, log reason and stop (do not queue/call)
      if (!eligibility.isEligible) {
        this.logger.warn(
          `Lead ${event.leadId} is NOT eligible for AI call job. Reason: ${eligibility.reason}`,
        );
        return;
      }

      // 3. If eligible, create call job in PENDING status
      const job = await this.callJobsService.createCallJob({
        leadId: event.leadId,
        clientId: event.clientId,
        idempotencyKey,
        priority: CallJobPriority.HIGH,
        scheduledAt: new Date(),
        metadata: {
          eventId: event.eventId,
          source: event.source,
          origin: 'LEAD_CREATED_EVENT',
          leadName: `${eligibility.lead?.firstName || ''} ${eligibility.lead?.lastName || ''}`.trim(),
          phone: eligibility.lead?.phone,
        },
      });

      this.logger.log(
        `Created AI Call Job ${job.id} for lead ${event.leadId} (status=${job.status}). Enqueueing to dispatch queue...`,
      );

      // 4. Enqueue into background queue: PENDING -> QUEUED
      await this.callQueueService.enqueueCallJob(
        job.id,
        event.leadId,
        event.clientId,
        CallJobPriority.HIGH,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to process lead.created event for lead ${event.leadId}: ${err.message}`,
        err.stack,
      );
    }
  }
}
