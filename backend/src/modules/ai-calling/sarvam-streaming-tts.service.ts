import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import WebSocket from 'ws';

export interface StreamingTtsCallbacks {
  onAudioChunk?: (base64Audio: string) => void;
  onCompletion?: () => void;
  onError?: (err: any) => void;
  onClose?: (code: number, reason: string) => void;
}

export interface StreamingTtsConfig {
  languageCode: string; // 'en-IN', 'hi-IN', 'te-IN'
  speaker: string; // e.g. 'simran_en_customer', 'kavya_hi_conversational'
  outputAudioCodec?: 'wav' | 'mp3';
}

@Injectable()
export class SarvamStreamingTtsService {
  private readonly logger = new Logger(SarvamStreamingTtsService.name);
  private readonly baseUrl = 'wss://api.sarvam.ai/text-to-speech/ws';
  private readonly defaultModel = 'bulbul:v4-flash';

  private getApiKey(): string {
    const key = process.env.SARVAM_API_KEY?.trim();
    if (!key) {
      throw new UnauthorizedException('SARVAM_API_KEY environment variable is missing.');
    }
    return key;
  }

  /**
   * Connect to Sarvam's official real-time streaming TTS WebSocket
   */
  createSession(
    config: StreamingTtsConfig,
    callbacks: StreamingTtsCallbacks,
  ): {
    sendText: (text: string) => void;
    flush: () => void;
    abort: () => void;
    isOpen: () => boolean;
  } {
    const apiKey = this.getApiKey();
    const url = `${this.baseUrl}?model=${this.defaultModel}&send_completion_event=true`;

    const ws = new WebSocket(url, {
      headers: {
        'api-subscription-key': apiKey,
      },
    });

    let isConnected = false;
    let isAborted = false;
    let isFlushPending = false;
    const pendingTextQueue: string[] = [];

    ws.on('open', () => {
      this.logger.log('Sarvam TTS Streaming WebSocket connected.');
      isConnected = true;

      // 1. Send initial configuration frame
      ws.send(
        JSON.stringify({
          type: 'config',
          data: {
            language_code: config.languageCode,
            speaker: config.speaker,
            output_audio_codec: config.outputAudioCodec || 'wav',
          },
        }),
      );

      // 2. Flush any pending text chunks queued before socket was ready
      while (pendingTextQueue.length > 0 && !isAborted) {
        const text = pendingTextQueue.shift();
        if (text && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'text',
              data: { text },
            }),
          );
        }
      }

      // 3. Flush if flush was called before connection was established
      if (isFlushPending && !isAborted && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'flush' }));
        isFlushPending = false;
      }
    });

    ws.on('message', (data: WebSocket.RawData) => {
      if (isAborted) return;
      try {
        const parsed = JSON.parse(data.toString());

        if (parsed.type === 'audio') {
          const base64Chunk = parsed.data?.audio;
          if (base64Chunk) {
            callbacks.onAudioChunk?.(base64Chunk);
          }
        } else if (parsed.type === 'event' && parsed.data?.event_type === 'final') {
          this.logger.log('TTS streaming completed (final event received).');
          callbacks.onCompletion?.();
        } else if (parsed.type === 'error') {
          this.logger.error(`TTS WebSocket error frame: ${JSON.stringify(parsed)}`);
          callbacks.onError?.(parsed);
        }
      } catch (err: any) {
        this.logger.error(`Failed to parse TTS message: ${err.message}`);
      }
    });

    ws.on('error', (err) => {
      if (!isAborted) {
        this.logger.error(`TTS WebSocket error: ${err.message}`);
        callbacks.onError?.(err);
      }
    });

    ws.on('close', (code, reason) => {
      this.logger.log(`TTS WebSocket closed (code: ${code}, reason: ${reason})`);
      callbacks.onClose?.(code, reason.toString());
    });

    const sendText = (text: string) => {
      if (isAborted) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      if (isConnected && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'text',
            data: { text: trimmed },
          }),
        );
      } else {
        pendingTextQueue.push(trimmed);
      }
    };

    const flush = () => {
      if (isAborted) return;
      if (isConnected && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'flush',
          }),
        );
      } else {
        isFlushPending = true;
      }
    };

    const abort = () => {
      isAborted = true;
      isFlushPending = false;
      pendingTextQueue.length = 0;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };

    const isOpen = () => !isAborted && ws.readyState === WebSocket.OPEN;

    return { sendText, flush, abort, isOpen };
  }
}
