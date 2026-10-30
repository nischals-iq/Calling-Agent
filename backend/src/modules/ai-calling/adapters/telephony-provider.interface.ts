import { TelephonyStatus } from '@prisma/client';
import { WebhookEventPayload } from '../call-session.service.js';

export interface InitiateCallParams {
  clientId: string;
  leadId: string;
  callJobId: string;
  phone: string;
  languageUsed?: string;
  callerId?: string;
  streamUrl?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface InitiateCallResult {
  success: boolean;
  providerCallId: string;
  status: TelephonyStatus;
  provider: 'MOCK_TELEPHONY' | 'EXOTEL';
  isSimulated: boolean;
  rawResponse?: any;
  error?: string;
}

export interface CallStatusResult {
  providerCallId: string;
  status: TelephonyStatus;
  durationSeconds?: number;
  recordingUrl?: string;
  outcome?: string;
  rawResponse?: any;
}

export interface TelephonyProvider {
  readonly name: 'MOCK_TELEPHONY' | 'EXOTEL';
  readonly isSimulated: boolean;

  initiateCall(params: InitiateCallParams): Promise<InitiateCallResult>;
  getCallStatus(providerCallId: string): Promise<CallStatusResult>;
  terminateCall(providerCallId: string): Promise<boolean>;
  normalizeWebhookEvent(payload: any, headers?: Record<string, any>): WebhookEventPayload;
}
