import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AiCallingController } from './ai-calling.controller.js';
import { TelephonyWebhookController } from './controllers/telephony-webhook.controller.js';
import { AiCallingService } from './ai-calling.service.js';
import { CallEligibilityService } from './call-eligibility.service.js';
import { CallJobsService } from './call-jobs.service.js';
import { CallQueueService, AI_CALLING_QUEUE } from './call-queue.service.js';
import { CallSessionService } from './call-session.service.js';
import { MockTelephonyAdapter } from './adapters/mock-telephony.adapter.js';
import { ExotelAdapter } from './adapters/exotel.adapter.js';
import { TelephonyProviderService } from './adapters/telephony-provider.service.js';
import { CallRetryService } from './call-retry.service.js';
import { AiCallingWorker } from './workers/ai-calling.worker.js';
import { LeadCreatedListener } from './listeners/lead-created.listener.js';
import { SarvamLlmService } from './sarvam-llm.service.js';
import { SarvamConversationService } from './sarvam-conversation.service.js';
import { SarvamSttService } from './sarvam-stt.service.js';
import { SarvamTtsService } from './sarvam-tts.service.js';
import { SarvamStreamingSttService } from './sarvam-streaming-stt.service.js';
import { SarvamStreamingTtsService } from './sarvam-streaming-tts.service.js';
import { SarvamStreamingLlmService } from './sarvam-streaming-llm.service.js';
import { VoiceConversationOrchestratorService } from './voice-conversation-orchestrator.service.js';
import { VoiceConversationGateway } from './voice-conversation.gateway.js';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: AI_CALLING_QUEUE,
    }),
  ],
  controllers: [AiCallingController, TelephonyWebhookController],
  providers: [
    AiCallingService,
    CallEligibilityService,
    CallJobsService,
    CallQueueService,
    CallSessionService,
    MockTelephonyAdapter,
    ExotelAdapter,
    TelephonyProviderService,
    CallRetryService,
    AiCallingWorker,
    LeadCreatedListener,
    SarvamLlmService,
    SarvamConversationService,
    SarvamSttService,
    SarvamTtsService,
    SarvamStreamingSttService,
    SarvamStreamingTtsService,
    SarvamStreamingLlmService,
    VoiceConversationOrchestratorService,
    VoiceConversationGateway,
  ],
  exports: [
    AiCallingService,
    CallEligibilityService,
    CallJobsService,
    CallQueueService,
    CallSessionService,
    MockTelephonyAdapter,
    ExotelAdapter,
    TelephonyProviderService,
    CallRetryService,
    SarvamLlmService,
    SarvamConversationService,
    SarvamSttService,
    SarvamTtsService,
    SarvamStreamingSttService,
    SarvamStreamingTtsService,
    SarvamStreamingLlmService,
    VoiceConversationOrchestratorService,
    VoiceConversationGateway,
  ],
})
export class AiCallingModule {}


