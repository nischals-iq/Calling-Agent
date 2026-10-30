import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamingLlmCallbacks {
  onTokenChunk?: (delta: string) => void;
  onSentence?: (sentence: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: any) => void;
}

@Injectable()
export class SarvamStreamingLlmService {
  private readonly logger = new Logger(SarvamStreamingLlmService.name);
  private readonly apiUrl = 'https://api.sarvam.ai/v1/chat/completions';
  private readonly model = 'sarvam-105b-conversations';

  private getApiKey(): string {
    const key = process.env.SARVAM_API_KEY?.trim();
    if (!key) {
      throw new UnauthorizedException('SARVAM_API_KEY environment variable is missing.');
    }
    return key;
  }

  /**
   * Stream LLM completion from Sarvam 105B and parse into sentence chunks for TTS
   */
  async streamChatCompletion(
    messages: ChatMessage[],
    callbacks: StreamingLlmCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<string> {
    const apiKey = this.getApiKey();

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 300,
        stream: true,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam LLM Stream API error (${response.status}): ${errText}`);
    }

    if (!response.body) {
      throw new Error('Sarvam LLM response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let fullResponse = '';
    let sentenceBuffer = '';
    let buffer = '';

    const sentenceDelimiters = ['.', '?', '!', '\n', '।'];

    try {
      while (true) {
        if (abortSignal?.aborted) {
          this.logger.log('LLM stream aborted by signal (barge-in).');
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          if (trimmed === 'data: [DONE]') continue;

          try {
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';

            if (delta) {
              fullResponse += delta;
              sentenceBuffer += delta;
              callbacks.onTokenChunk?.(delta);

              // Check if sentence delimiter exists and buffer length is meaningful
              const hasDelimiter = sentenceDelimiters.some((d) => sentenceBuffer.includes(d));
              if (hasDelimiter && sentenceBuffer.trim().length >= 15) {
                callbacks.onSentence?.(sentenceBuffer.trim());
                sentenceBuffer = '';
              }
            }
          } catch {
            // ignore JSON parse chunk splits
          }
        }
      }

      // Flush any trailing sentence buffer
      if (sentenceBuffer.trim()) {
        callbacks.onSentence?.(sentenceBuffer.trim());
      }

      callbacks.onComplete?.(fullResponse.trim());
      return fullResponse.trim();
    } catch (err: any) {
      if (abortSignal?.aborted || err.name === 'AbortError') {
        this.logger.log('LLM stream successfully aborted.');
        return fullResponse.trim();
      }
      callbacks.onError?.(err);
      throw err;
    }
  }
}
