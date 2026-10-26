import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AiCallingController } from './ai-calling.controller.js';
import { AiCallingService } from './ai-calling.service.js';
import { CallEligibilityService } from './call-eligibility.service.js';
import { CallJobsService } from './call-jobs.service.js';
import { CallQueueService, AI_CALLING_QUEUE } from './call-queue.service.js';
import { AiCallingWorker } from './workers/ai-calling.worker.js';
import { LeadCreatedListener } from './listeners/lead-created.listener.js';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: AI_CALLING_QUEUE,
    }),
  ],
  controllers: [AiCallingController],
  providers: [
    AiCallingService,
    CallEligibilityService,
    CallJobsService,
    CallQueueService,
    AiCallingWorker,
    LeadCreatedListener,
  ],
  exports: [
    AiCallingService,
    CallEligibilityService,
    CallJobsService,
    CallQueueService,
  ],
})
export class AiCallingModule {}
