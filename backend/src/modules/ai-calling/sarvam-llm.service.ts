import { Injectable, Logger } from '@nestjs/common';

export interface SarvamChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SarvamChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface SarvamChatResponse {
  success: boolean;
  model: string;
  content: string;
  durationMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  rawStatus?: number;
  error?: string;
}

@Injectable()
export class SarvamLlmService {
  private readonly logger = new Logger(SarvamLlmService.name);
  private readonly apiUrl = 'https://api.sarvam.ai/v1/chat/completions';
  private readonly defaultModel = 'sarvam-105b-conversations';

  /**
   * Retrieves the Sarvam API key from process environment.
   * Safety guard: Never prints or logs the key value.
   */
  private getApiKey(): string {
    const key = process.env.SARVAM_API_KEY?.trim();
    if (!key) {
      throw new Error(
        'SARVAM_API_KEY environment variable is not configured in backend/.env',
      );
    }
    return key;
  }

  /**
   * Sends a conversational chat completion request to Sarvam's official API
   */
  async chatCompletion(
    messages: SarvamChatMessage[],
    options: SarvamChatOptions = {},
  ): Promise<SarvamChatResponse> {
    const apiKey = this.getApiKey();
    const model = options.model || this.defaultModel;
    const timeoutMs = options.timeoutMs ?? 30000;
    const startTime = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1024,
        }),
        signal: controller.signal,
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errJson = await response.json();
          errorDetails =
            errJson.message || errJson.error || JSON.stringify(errJson);
        } catch {
          errorDetails = await response.text();
        }

        // Handle specific API error conditions without revealing credentials
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `Sarvam API authentication failed (HTTP ${response.status}): Invalid or unauthorized API key. Details: ${errorDetails}`,
          );
        } else if (response.status === 429) {
          throw new Error(
            `Sarvam API rate limit exceeded (HTTP 429). Details: ${errorDetails}`,
          );
        } else if (response.status >= 500) {
          throw new Error(
            `Sarvam API server error (HTTP ${response.status}). Details: ${errorDetails}`,
          );
        } else {
          throw new Error(
            `Sarvam API error (HTTP ${response.status}): ${errorDetails}`,
          );
        }
      }

      const data = await response.json();
      const content =
        data.choices?.[0]?.message?.content ??
        data.choices?.[0]?.text ??
        '';

      return {
        success: true,
        model: data.model || model,
        content,
        durationMs,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        rawStatus: response.status,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      if (err.name === 'AbortError') {
        throw new Error(
          `Sarvam API request timed out after ${timeoutMs}ms`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Helper test method to verify connectivity using a simple prompt
   */
  async testConnection(
    prompt = 'Hello, introduce yourself in Hindi.',
  ): Promise<SarvamChatResponse> {
    return this.chatCompletion([
      {
        role: 'user',
        content: prompt,
      },
    ]);
  }
}
