import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TelephonyStatus, CallJobStatus } from '@prisma/client';

export interface CreateCallSessionDto {
  clientId: string;
  leadId: string;
  callJobId: string;
  provider?: string;
  providerCallId: string;
  languageUsed?: string;
  metadata?: Record<string, any>;
}

export interface WebhookEventPayload {
  eventId?: string;
  providerCallId: string;
  callJobId?: string;
  event: 'INITIATED' | 'RINGING' | 'CONNECTED' | 'BUSY' | 'NO_ANSWER' | 'FAILED' | 'COMPLETED';
  timestamp?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  reason?: string;
  errorCode?: string;
  outcome?: string;
  metadata?: Record<string, any>;
}

export interface AddMessageDto {
  sessionId: string;
  speaker: 'AGENT' | 'PROSPECT' | 'SYSTEM';
  transcriptText: string;
  languageCode?: string;
  turnOrder?: number;
}

export enum CallBusinessOutcome {
  QUALIFIED = 'QUALIFIED',
  FOLLOW_UP_REQUIRED = 'FOLLOW_UP_REQUIRED',
  HUMAN_HANDOFF = 'HUMAN_HANDOFF',
  NOT_INTERESTED = 'NOT_INTERESTED',
  OPTED_OUT = 'OPTED_OUT',
  BUSY = 'BUSY',
  NO_ANSWER = 'NO_ANSWER',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// State priority ranking to prevent out-of-order state regression
const TELEPHONY_STATUS_RANK: Record<TelephonyStatus, number> = {
  [TelephonyStatus.INITIATED]: 1,
  [TelephonyStatus.RINGING]: 2,
  [TelephonyStatus.CONNECTED]: 3,
  [TelephonyStatus.BUSY]: 4,
  [TelephonyStatus.NO_ANSWER]: 4,
  [TelephonyStatus.FAILED]: 4,
  [TelephonyStatus.COMPLETED]: 4,
  [TelephonyStatus.CANCELLED]: 4,
};

const TERMINAL_TELEPHONY_STATUSES: readonly TelephonyStatus[] = [
  TelephonyStatus.COMPLETED,
  TelephonyStatus.BUSY,
  TelephonyStatus.NO_ANSWER,
  TelephonyStatus.FAILED,
  TelephonyStatus.CANCELLED,
];

@Injectable()
export class CallSessionService {
  private readonly logger = new Logger(CallSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new call session record when a call is dispatched/initiated.
   */
  async createSession(dto: CreateCallSessionDto) {
    this.logger.log(
      `Creating call session for job ${dto.callJobId}, lead ${dto.leadId}, providerCallId=${dto.providerCallId}`,
    );

    return this.prisma.aiCallSession.create({
      data: {
        clientId: dto.clientId,
        leadId: dto.leadId,
        callJobId: dto.callJobId,
        provider: dto.provider || 'MOCK_TELEPHONY',
        providerCallId: dto.providerCallId,
        status: TelephonyStatus.INITIATED,
        languageUsed: dto.languageUsed || 'en',
        startedAt: new Date(),
        metadata: dto.metadata || {},
      },
    });
  }

  /**
   * Retrieves a session by its unique provider call identifier.
   */
  async getSessionByProviderCallId(providerCallId: string) {
    return this.prisma.aiCallSession.findUnique({
      where: { providerCallId },
      include: {
        lead: true,
        callJob: true,
        messages: { orderBy: { turnOrder: 'asc' } },
      },
    });
  }

  /**
   * Retrieves all sessions for a specific call job.
   */
  async getSessionsForJob(callJobId: string, clientId: string) {
    return this.prisma.aiCallSession.findMany({
      where: { callJobId, clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: { orderBy: { turnOrder: 'asc' } },
      },
    });
  }

  /**
   * Processes incoming telephony webhook events idempotently with out-of-order and terminal state protection.
   */
  async handleWebhookEvent(payload: WebhookEventPayload) {
    const { providerCallId, event } = payload;
    this.logger.log(
      `Processing telephony webhook event: ${event} for providerCallId=${providerCallId}`,
    );

    // 1. Locate existing session
    const session = await this.prisma.aiCallSession.findUnique({
      where: { providerCallId },
      include: { callJob: true, lead: true },
    });

    if (!session) {
      this.logger.warn(`No session found for providerCallId="${providerCallId}". Event ignored.`);
      throw new NotFoundException(`Call session not found for providerCallId: ${providerCallId}`);
    }

    const targetStatus = event as TelephonyStatus;
    const currentRank = TELEPHONY_STATUS_RANK[session.status];
    const incomingRank = TELEPHONY_STATUS_RANK[targetStatus];

    // 2. Duplicate Event Check: identical status already recorded
    if (session.status === targetStatus) {
      this.logger.log(
        `Idempotent duplicate event: session ${session.id} is already in state ${targetStatus}.`,
      );
      return {
        success: true,
        session,
        duplicate: true,
        ignored: false,
        message: 'Duplicate event acknowledged idempotently',
      };
    }

    // 3. Terminal State Protection: Once a session reaches a terminal state, it cannot be overwritten by subsequent events
    if (TERMINAL_TELEPHONY_STATUSES.includes(session.status)) {
      this.logger.warn(
        `Terminal status protection: session ${session.id} is already in terminal state ${session.status}. Event ${event} rejected.`,
      );
      return {
        success: true,
        session,
        duplicate: false,
        ignored: true,
        reason: 'ALREADY_TERMINAL',
        message: `Session is already in terminal state ${session.status}. Cannot transition to ${event}.`,
      };
    }

    // 4. Out-of-Order Check: incoming event rank is lower than current session rank
    // e.g. receiving RINGING after already being CONNECTED
    if (incomingRank < currentRank) {
      this.logger.warn(
        `Out-of-order event ignored: received ${event} (rank ${incomingRank}) for session ${session.id} currently in ${session.status} (rank ${currentRank})`,
      );
      return {
        success: true,
        session,
        duplicate: false,
        ignored: true,
        reason: 'OUT_OF_ORDER_EVENT',
        message: `Ignored out-of-order event ${event}. Current state is ${session.status}.`,
      };
    }

    // 5. Update session data based on transition
    const updateData: any = {
      status: targetStatus,
      updatedAt: new Date(),
    };

    if (payload.metadata) {
      updateData.metadata = {
        ...((session.metadata as Record<string, any>) || {}),
        ...payload.metadata,
      };
    }

    if (payload.reason || payload.errorCode) {
      updateData.failureReason = payload.reason || payload.errorCode;
    }

    if (targetStatus === TelephonyStatus.CONNECTED && !session.connectedAt) {
      updateData.connectedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
    }

    if (TERMINAL_TELEPHONY_STATUSES.includes(targetStatus)) {
      updateData.endedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();

      if (payload.durationSeconds !== undefined) {
        updateData.durationSeconds = payload.durationSeconds;
      } else if (session.connectedAt) {
        const duration = Math.max(
          0,
          Math.floor((updateData.endedAt.getTime() - session.connectedAt.getTime()) / 1000),
        );
        updateData.durationSeconds = duration;
      }

      if (payload.recordingUrl) {
        updateData.recordingReference = payload.recordingUrl;
      }

      if (payload.outcome) {
        updateData.outcome = payload.outcome;
      } else {
        updateData.outcome = targetStatus;
      }
    }

    const updatedSession = await this.prisma.aiCallSession.update({
      where: { id: session.id },
      data: updateData,
      include: { callJob: true, lead: true },
    });

    this.logger.log(
      `Session ${session.id} updated: ${session.status} -> ${targetStatus} (outcome: ${updatedSession.outcome})`,
    );

    return {
      success: true,
      session: updatedSession,
      duplicate: false,
      ignored: false,
    };
  }

  /**
   * Adds a transcript conversation turn message to the session.
   */
  async addMessage(dto: AddMessageDto) {
    return this.prisma.aiCallMessage.create({
      data: {
        sessionId: dto.sessionId,
        speaker: dto.speaker,
        transcriptText: dto.transcriptText,
        languageCode: dto.languageCode || 'en',
        turnOrder: dto.turnOrder || 0,
      },
    });
  }
}
