import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { CallJobsService } from './call-jobs.service.js';
import {
  SarvamConversationService,
  SupportedLanguage,
} from './sarvam-conversation.service.js';
import { SarvamSttService } from './sarvam-stt.service.js';
import { SarvamTtsService } from './sarvam-tts.service.js';

@Controller('client/ai-calling')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AiCallingController {
  constructor(
    private readonly callJobsService: CallJobsService,
    private readonly conversationService: SarvamConversationService,
    private readonly sttService: SarvamSttService,
    private readonly ttsService: SarvamTtsService,
  ) {}

  /**
   * GET /api/client/ai-calling/jobs
   * Retrieves all AI call jobs for the authenticated client tenant
   */
  @Get('jobs')
  async getCallJobs(@CurrentTenant() tenantId: string) {
    return this.callJobsService.getTenantCallJobs(tenantId);
  }

  /**
   * GET /api/client/ai-calling/jobs/:id
   * Retrieves full details of a specific AI call job, its sessions, and transcripts
   */
  @Get('jobs/:id')
  async getJobDetails(
    @CurrentTenant() tenantId: string,
    @Param('id') jobId: string,
  ) {
    const job = await this.callJobsService.getJobDetails(jobId, tenantId);
    if (!job) {
      throw new NotFoundException(`Call job with ID ${jobId} not found`);
    }
    return job;
  }

  /**
   * POST /api/client/ai-calling/conversations/start
   * Starts a new text-based multi-turn AI Calling Conversation Playground session
   */
  @Post('conversations/start')
  async startConversation(
    @CurrentTenant() tenantId: string,
    @Body() body: { language?: SupportedLanguage },
  ) {
    return this.conversationService.startConversation(
      tenantId,
      body?.language || 'en',
    );
  }

  /**
   * POST /api/client/ai-calling/conversations/:id/message
   * Sends a customer message turn and retrieves real Sarvam LLM response
   */
  @Post('conversations/:id/message')
  async sendCustomerMessage(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    return this.conversationService.sendMessage(id, tenantId, body?.message);
  }

  /**
   * POST /api/client/ai-calling/conversations/:id/language
   * Switches the language during an active conversation while preserving multi-turn memory
   */
  @Post('conversations/:id/language')
  async switchConversationLanguage(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { language: SupportedLanguage },
  ) {
    if (!body?.language) {
      throw new BadRequestException('Language is required.');
    }
    return this.conversationService.switchLanguage(id, tenantId, body.language);
  }

  /**
   * GET /api/client/ai-calling/conversations/:id
   * Retrieves conversation history and metadata
   */
  @Get('conversations/:id')
  async getConversation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.conversationService.getConversation(id, tenantId);
  }

  /**
   * DELETE /api/client/ai-calling/conversations/:id
   * Resets / ends the conversation session
   */
  @Delete('conversations/:id')
  async endConversation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.conversationService.endConversation(id, tenantId);
  }

  /**
   * POST /api/client/ai-calling/speech/transcribe
   * Transcribes speech audio using Sarvam Saaras v4
   */
  @Post('speech/transcribe')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: SarvamSttService.MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  async transcribeSpeech(
    @CurrentTenant() _tenantId: string,
    @UploadedFile() file: any,
    @Body('languageCode') languageCode?: string,
    @Body('mode') mode?: any,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required in "file" form field.');
    }
    return this.sttService.transcribeAudio(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        languageCode,
        mode,
      },
    );
  }

  /**

   * POST /api/client/ai-calling/speech/synthesize
   * Synthesizes text into natural speech audio using Sarvam Bulbul v4 Flash
   */
  @Post('speech/synthesize')
  async synthesizeSpeech(
    @CurrentTenant() _tenantId: string,
    @Body()
    body: {
      text: string;
      languageCode?: string;
      speaker?: string;
      pace?: number;
      outputAudioCodec?: 'wav' | 'mp3';
    },
  ) {
    if (!body?.text || typeof body.text !== 'string' || !body.text.trim()) {
      throw new BadRequestException(
        'Text to synthesize is required and cannot be empty.',
      );
    }
    return this.ttsService.synthesizeSpeech(body.text, {
      languageCode: body.languageCode,
      speaker: body.speaker,
      pace: body.pace,
      outputAudioCodec: body.outputAudioCodec,
    });
  }

  /**
   * GET /api/client/ai-calling/speech/voices
   * Returns supported Bulbul v4 voice personas for the specified language
   */
  @Get('speech/voices')
  async getVoices(
    @CurrentTenant() _tenantId: string,
    @Query('languageCode') languageCode?: string,
  ) {
    return this.ttsService.getAvailableVoices(languageCode);
  }
}
