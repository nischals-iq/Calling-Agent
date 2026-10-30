import { Injectable, Logger } from '@nestjs/common';
import { TelephonyStatus } from '@prisma/client';
import {
  TelephonyProvider,
  InitiateCallParams,
  InitiateCallResult,
  CallStatusResult,
} from './telephony-provider.interface.js';
import { CallSessionService, WebhookEventPayload } from '../call-session.service.js';

export interface ExotelConfig {
  accountSid: string;
  apiKey: string;
  apiToken: string;
  subdomain: string;
  callerId: string;
  isEnabled: boolean;
  appId?: string;
  callbackUrl?: string;
  streamUrl?: string;
}

@Injectable()
export class ExotelAdapter implements TelephonyProvider {
  readonly name = 'EXOTEL' as const;
  readonly isSimulated = false;
  private readonly logger = new Logger(ExotelAdapter.name);

  constructor(private readonly sessionService: CallSessionService) {}

  /**
   * Retrieves Exotel configuration from environment variables.
   * Credentials must never be hardcoded.
   */
  public getConfig(): ExotelConfig {
    return {
      accountSid: process.env.EXOTEL_ACCOUNT_SID || '',
      apiKey: process.env.EXOTEL_API_KEY || '',
      apiToken: process.env.EXOTEL_API_TOKEN || '',
      subdomain: process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com',
      callerId: process.env.EXOTEL_CALLER_ID || '',
      isEnabled: process.env.EXOTEL_ENABLED === 'true',
      appId: process.env.EXOTEL_APP_ID,
      callbackUrl: process.env.EXOTEL_CALLBACK_URL,
      streamUrl: process.env.EXOTEL_STREAM_URL,
    };
  }

  /**
   * Initiates an outbound call via Exotel REST API.
   *
   * Endpoint: POST https://<api_key>:<api_token>@<subdomain>/v1/Accounts/<account_sid>/Calls/connect.json
   *
   * SAFETY GUARD:
   * Real outbound dialing is disabled by default unless EXOTEL_ENABLED='true'.
   */
  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const config = this.getConfig();

    this.logger.log(
      `[EXOTEL] Preparing outbound call to ${params.phone} for job ${params.callJobId}`,
    );

    // 1. Safety check: Real calling must remain disabled unless explicitly enabled
    if (!config.isEnabled) {
      this.logger.warn(
        `[EXOTEL] Outbound dialing is DISABLED (EXOTEL_ENABLED !== 'true'). Call to ${params.phone} aborted for safety.`,
      );
      throw new Error(
        'Exotel outbound calling is disabled in configuration (EXOTEL_ENABLED is false).',
      );
    }

    // 2. Validate essential credentials
    if (!config.accountSid || !config.apiKey || !config.apiToken) {
      this.logger.error(
        '[EXOTEL] Missing required credentials (EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, or EXOTEL_API_TOKEN).',
      );
      throw new Error('Exotel credentials are not configured in environment variables.');
    }

    const callerId = params.callerId || config.callerId;
    if (!callerId) {
      this.logger.error('[EXOTEL] Missing Caller ID (Virtual Number).');
      throw new Error('Exotel Caller ID (Virtual Number) is required to place outbound calls.');
    }

    // 3. Prepare payload for Exotel Calls/connect API
    const endpoint = `https://${config.subdomain}/v1/Accounts/${config.accountSid}/Calls/connect.json`;
    const basicAuth = Buffer.from(`${config.apiKey}:${config.apiToken}`).toString('base64');

    const callbackUrl = params.callbackUrl || config.callbackUrl;

    const postData = new URLSearchParams();
    postData.append('From', params.phone);
    postData.append('CallerId', callerId);

    // Audio stream or flow execution URL
    const appUrl =
      params.streamUrl ||
      config.streamUrl ||
      (config.appId
        ? `http://my.exotel.com/${config.accountSid}/exoml/start_voice/${config.appId}`
        : undefined);

    if (appUrl) {
      postData.append('Url', appUrl);
    }

    if (callbackUrl) {
      postData.append('StatusCallback', callbackUrl);
      postData.append('StatusCallbackEvents[0]', 'terminal');
      postData.append('StatusCallbackEvents[1]', 'answered');
    }

    // Attach contextual metadata
    postData.append(
      'CustomField',
      JSON.stringify({
        clientId: params.clientId,
        callJobId: params.callJobId,
        leadId: params.leadId,
      }),
    );

    try {
      this.logger.log(`[EXOTEL] Sending POST to ${endpoint} for ${params.phone}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: postData.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`[EXOTEL] API returned HTTP ${response.status}: ${errorText}`);
        throw new Error(`Exotel API call failed (${response.status}): ${errorText}`);
      }

      const responseData = (await response.json()) as any;
      const callData = responseData?.Call;
      const providerCallId = callData?.Sid;

      if (!providerCallId) {
        throw new Error('Exotel API did not return a valid Call.Sid in response');
      }

      this.logger.log(
        `[EXOTEL] Call accepted by provider. Sid: ${providerCallId}, Status: ${callData.Status}`,
      );

      // 4. Save call session in database
      const session = await this.sessionService.createSession({
        clientId: params.clientId,
        leadId: params.leadId,
        callJobId: params.callJobId,
        provider: 'EXOTEL',
        providerCallId,
        languageUsed: params.languageUsed || 'en',
        metadata: {
          isSimulated: false,
          provider: 'EXOTEL',
          phone: params.phone,
          callerId,
          exotelStatus: callData.Status,
          exotelDateCreated: callData.DateCreated,
          ...(params.metadata || {}),
        },
      });

      return {
        success: true,
        providerCallId,
        status: TelephonyStatus.INITIATED,
        provider: 'EXOTEL',
        isSimulated: false,
        rawResponse: responseData,
      };
    } catch (err: any) {
      this.logger.error(`[EXOTEL] Outbound call error: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Retrieves call status from Exotel Call Details API.
   * Endpoint: GET https://<api_key>:<api_token>@<subdomain>/v1/Accounts/<account_sid>/Calls/<CallSid>.json
   */
  async getCallStatus(providerCallId: string): Promise<CallStatusResult> {
    const config = this.getConfig();
    if (!config.accountSid || !config.apiKey || !config.apiToken) {
      throw new Error('Exotel credentials not configured');
    }

    const endpoint = `https://${config.subdomain}/v1/Accounts/${config.accountSid}/Calls/${providerCallId}.json`;
    const basicAuth = Buffer.from(`${config.apiKey}:${config.apiToken}`).toString('base64');

    const response = await fetch(endpoint, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });

    if (!response.ok) {
      throw new Error(
        `Exotel getCallStatus failed (${response.status}): ${await response.text()}`,
      );
    }

    const data = (await response.json()) as any;
    const call = data?.Call;
    const status = this.mapExotelStatus(call?.Status);

    return {
      providerCallId,
      status,
      durationSeconds: call?.Duration ? parseInt(call.Duration, 10) : undefined,
      recordingUrl: call?.RecordingUrl,
      outcome: call?.Status,
      rawResponse: data,
    };
  }

  /**
   * Terminates an ongoing call leg via Exotel API.
   */
  async terminateCall(providerCallId: string): Promise<boolean> {
    const config = this.getConfig();
    if (!config.accountSid || !config.apiKey || !config.apiToken) return false;

    const endpoint = `https://${config.subdomain}/v1/Accounts/${config.accountSid}/Calls/${providerCallId}.json`;
    const basicAuth = Buffer.from(`${config.apiKey}:${config.apiToken}`).toString('base64');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Status=completed',
    });

    return res.ok;
  }

  /**
   * Normalizes Exotel's actual StatusCallback webhook payload into internal WebhookEventPayload.
   * Supports both multipart/form-data and application/x-www-form-urlencoded payloads.
   */
  normalizeWebhookEvent(payload: any): WebhookEventPayload {
    const providerCallId = payload.CallSid || payload.Sid || payload.providerCallId;
    const rawStatus = (payload.Status || payload.event || '').toLowerCase();
    const eventType = (payload.EventType || '').toLowerCase();

    let event: WebhookEventPayload['event'] = 'COMPLETED';

    if (rawStatus === 'completed') {
      event = 'COMPLETED';
    } else if (rawStatus === 'busy') {
      event = 'BUSY';
    } else if (rawStatus === 'no-answer') {
      event = 'NO_ANSWER';
    } else if (rawStatus === 'failed') {
      event = 'FAILED';
    } else if (rawStatus === 'canceled' || rawStatus === 'cancelled') {
      event = 'FAILED';
    } else if (rawStatus === 'in-progress' || eventType === 'answered') {
      event = 'CONNECTED';
    } else if (rawStatus === 'ringing') {
      event = 'RINGING';
    } else if (rawStatus === 'queued' || rawStatus === 'initiated') {
      event = 'INITIATED';
    }

    const duration =
      payload.ConversationDuration !== undefined
        ? parseInt(payload.ConversationDuration, 10)
        : payload.DialCallDuration !== undefined
          ? parseInt(payload.DialCallDuration, 10)
          : payload.Duration !== undefined
            ? parseInt(payload.Duration, 10)
            : undefined;

    let parsedMetadata = payload.metadata;
    let callJobId: string | undefined = payload.callJobId;

    if (payload.CustomField && typeof payload.CustomField === 'string') {
      try {
        const customObj = JSON.parse(payload.CustomField);
        if (customObj.callJobId) callJobId = customObj.callJobId;
        parsedMetadata = { ...(parsedMetadata || {}), ...customObj };
      } catch {
        parsedMetadata = { ...(parsedMetadata || {}), customField: payload.CustomField };
      }
    }

    return {
      providerCallId,
      callJobId,
      event,
      timestamp: payload.DateUpdated
        ? new Date(payload.DateUpdated).toISOString()
        : new Date().toISOString(),
      durationSeconds: duration,
      recordingUrl: payload.RecordingUrl,
      reason:
        payload.reason ||
        (event === 'BUSY'
          ? 'Line Busy'
          : event === 'NO_ANSWER'
            ? 'No Answer'
            : undefined),
      outcome: payload.outcome || (event === 'COMPLETED' ? 'COMPLETED' : event),
      metadata: parsedMetadata,
    };
  }

  private mapExotelStatus(status?: string): TelephonyStatus {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return TelephonyStatus.COMPLETED;
    if (s === 'busy') return TelephonyStatus.BUSY;
    if (s === 'no-answer') return TelephonyStatus.NO_ANSWER;
    if (s === 'failed') return TelephonyStatus.FAILED;
    if (s === 'in-progress') return TelephonyStatus.CONNECTED;
    if (s === 'ringing') return TelephonyStatus.RINGING;
    if (s === 'canceled' || s === 'cancelled') return TelephonyStatus.CANCELLED;
    return TelephonyStatus.INITIATED;
  }
}
