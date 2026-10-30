import { Injectable, Logger } from '@nestjs/common';
import { CallSessionService, WebhookEventPayload } from '../call-session.service.js';
import { randomUUID } from 'crypto';
import { TelephonyStatus } from '@prisma/client';
import {
  TelephonyProvider,
  InitiateCallParams,
  InitiateCallResult,
  CallStatusResult,
} from './telephony-provider.interface.js';

export type InitiateMockCallParams = InitiateCallParams;

@Injectable()
export class MockTelephonyAdapter implements TelephonyProvider {
  readonly name = 'MOCK_TELEPHONY' as const;
  readonly isSimulated = true;
  private readonly logger = new Logger(MockTelephonyAdapter.name);

  constructor(private readonly sessionService: CallSessionService) {}

  /**
   * Initiates a simulated outbound call and returns a providerCallId and session.
   * Does NOT connect to any real telephony provider.
   */
  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const providerCallId = `mock_call_${randomUUID()}`;

    this.logger.log(
      `[MOCK TELEPHONY] Initiating simulated outbound call to ${params.phone} (providerCallId: ${providerCallId})`,
    );

    const session = await this.sessionService.createSession({
      clientId: params.clientId,
      leadId: params.leadId,
      callJobId: params.callJobId,
      provider: 'MOCK_TELEPHONY',
      providerCallId,
      languageUsed: params.languageUsed || 'en',
      metadata: {
        isSimulated: true,
        mode: 'SIMULATION_FOUNDATION',
        phone: params.phone,
        ...(params.metadata || {}),
      },
    });

    return {
      success: true,
      providerCallId,
      status: TelephonyStatus.INITIATED,
      provider: 'MOCK_TELEPHONY',
      isSimulated: true,
      rawResponse: { session },
    };
  }

  /**
   * Retrieves status of a simulated call session.
   */
  async getCallStatus(providerCallId: string): Promise<CallStatusResult> {
    const session = await this.sessionService.getSessionByProviderCallId(providerCallId);
    return {
      providerCallId,
      status: session?.status || TelephonyStatus.INITIATED,
      durationSeconds: session?.durationSeconds || 0,
      recordingUrl: session?.recordingReference || undefined,
      outcome: session?.outcome || undefined,
      rawResponse: { session },
    };
  }

  /**
   * Terminates an ongoing simulated call session.
   */
  async terminateCall(providerCallId: string): Promise<boolean> {
    await this.sessionService.handleWebhookEvent({
      providerCallId,
      event: 'COMPLETED',
      outcome: 'TERMINATED',
    });
    return true;
  }

  /**
   * Normalizes incoming simulated event payload into standard internal WebhookEventPayload.
   */
  normalizeWebhookEvent(payload: any): WebhookEventPayload {
    return {
      providerCallId: payload.providerCallId,
      callJobId: payload.callJobId,
      event: payload.event,
      timestamp: payload.timestamp || new Date().toISOString(),
      durationSeconds: payload.durationSeconds,
      recordingUrl: payload.recordingUrl,
      reason: payload.reason,
      errorCode: payload.errorCode,
      outcome: payload.outcome,
      metadata: payload.metadata,
    };
  }

  /**
   * Simulates a controlled multi-step call progression for verification:
   * INITIATED -> RINGING (1000ms) -> CONNECTED (1500ms) -> COMPLETED (2000ms)
   * Or terminates as BUSY / NO_ANSWER / FAILED if requested.
   */
  async simulateProgression(
    providerCallId: string,
    targetOutcome: 'COMPLETED' | 'BUSY' | 'NO_ANSWER' | 'FAILED' = 'COMPLETED',
  ) {
    this.logger.log(
      `[MOCK TELEPHONY] Simulating call progression for ${providerCallId} towards ${targetOutcome}...`,
    );

    // 1. Ringing
    await new Promise((r) => setTimeout(r, 1000));
    await this.sessionService.handleWebhookEvent({
      providerCallId,
      event: 'RINGING',
      timestamp: new Date().toISOString(),
    });

    if (targetOutcome === 'BUSY' || targetOutcome === 'NO_ANSWER' || targetOutcome === 'FAILED') {
      await new Promise((r) => setTimeout(r, 1000));
      return this.sessionService.handleWebhookEvent({
        providerCallId,
        event: targetOutcome,
        timestamp: new Date().toISOString(),
        outcome: targetOutcome,
        reason: `Simulated ${targetOutcome}`,
      });
    }

    // 2. Connected
    await new Promise((r) => setTimeout(r, 1500));
    const connectedResult = await this.sessionService.handleWebhookEvent({
      providerCallId,
      event: 'CONNECTED',
      timestamp: new Date().toISOString(),
    });

    // 3. Add mock conversation messages (Section 10.3)
    if (connectedResult.session?.id) {
      await this.sessionService.addMessage({
        sessionId: connectedResult.session.id,
        speaker: 'AGENT',
        transcriptText: 'Hello! I am the automated calling assistant from your enquiry. Is this a good time to speak?',
        languageCode: 'en',
        turnOrder: 1,
      });

      await this.sessionService.addMessage({
        sessionId: connectedResult.session.id,
        speaker: 'PROSPECT',
        transcriptText: 'Yes, I had submitted an enquiry earlier.',
        languageCode: 'en',
        turnOrder: 2,
      });
    }

    // 4. Completed
    await new Promise((r) => setTimeout(r, 1500));
    return this.sessionService.handleWebhookEvent({
      providerCallId,
      event: 'COMPLETED',
      timestamp: new Date().toISOString(),
      durationSeconds: 4,
      outcome: 'QUALIFIED_LEAD',
      recordingUrl: 'https://mock-telephony.storage/recordings/mock_sample.wav',
    });
  }
}
