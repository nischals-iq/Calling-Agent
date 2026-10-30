import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import WebSocket from 'ws';

export interface StreamingSttCallbacks {
  onSessionBegin?: (config: any) => void;
  onSpeechStart?: (confidence: number) => void;
  onPartialTranscript?: (text: string, utteranceIdx: number) => void;
  onSpeechEnd?: () => void;
  onFinalTranscript?: (text: string, utteranceIdx: number) => void;
  onError?: (error: any) => void;
  onClose?: (code: number, reason: string) => void;
}

export interface StreamingSttOptions {
  languageCode?: string; // 'en-IN', 'hi-IN', 'te-IN'
  sampleRate?: number; // 16000 or 8000
  streamType?: 'fast' | 'balanced' | 'simulated';
}

@Injectable()
export class SarvamStreamingSttService {
  private readonly logger = new Logger(SarvamStreamingSttService.name);
  private readonly baseUrl = 'wss://api.sarvam.ai/speech-to-text-realtime/ws';

  private getApiKey(): string {
    const key = process.env.SARVAM_API_KEY?.trim();
    if (!key) {
      throw new UnauthorizedException('SARVAM_API_KEY environment variable is missing.');
    }
    return key;
  }

  /**
   * Connect to Sarvam's official real-time streaming STT WebSocket
   */
  createSession(
    options: StreamingSttOptions,
    callbacks: StreamingSttCallbacks,
  ): {
    sendAudioChunk: (pcmChunk: Buffer) => void;
    close: () => void;
    isOpen: () => boolean;
  } {
    const apiKey = this.getApiKey();
    const languageCode = options.languageCode || 'en-IN';
    const sampleRate = options.sampleRate || 16000;
    const streamType = options.streamType || 'balanced';

    const url = `${this.baseUrl}?language_code=${languageCode}&sample_rate=${sampleRate}&encoding=linear16&stream_type=${streamType}&turn_detection=vad`;
    this.logger.log(`Connecting to Sarvam STT WebSocket: ${url}`);

    const ws = new WebSocket(url, {
      headers: {
        'api-subscription-key': apiKey,
      },
    });

    let isSessionReady = false;
    const pendingChunks: Buffer[] = [];

    ws.on('open', () => {
      this.logger.log('Sarvam STT WebSocket connected.');
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.event) {
          case 'session.begin':
            isSessionReady = true;
            this.logger.log(`STT Session began: ${msg.request_id}`);
            callbacks.onSessionBegin?.(msg.config);
            // Flush any audio chunks received while opening
            while (pendingChunks.length > 0) {
              const chunk = pendingChunks.shift();
              if (chunk && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: 'audio_input', audio: chunk.toString('base64') }));
              }
            }
            break;

          case 'vad.speech_start':
            this.logger.debug(`VAD Speech Start detected (confidence: ${msg.confidence})`);
            callbacks.onSpeechStart?.(msg.confidence ?? 1.0);
            break;

          case 'transcript.partial':
            callbacks.onPartialTranscript?.(msg.text || '', msg.utterance_idx ?? 0);
            break;

          case 'vad.speech_end':
            this.logger.debug('VAD Speech End detected');
            callbacks.onSpeechEnd?.();
            break;

          case 'transcript.final':
            this.logger.log(`STT Final Transcript: "${msg.text}"`);
            callbacks.onFinalTranscript?.(msg.text || '', msg.utterance_idx ?? 0);
            break;

          case 'error':
            this.logger.error(`STT WebSocket API Error: ${JSON.stringify(msg)}`);
            callbacks.onError?.(msg);
            break;

          default:
            this.logger.debug(`STT unhandled event: ${msg.event}`);
            break;
        }
      } catch (err: any) {
        this.logger.error(`Failed to parse STT WS message: ${err.message}`);
      }
    });

    ws.on('error', (err) => {
      this.logger.error(`STT WebSocket error: ${err.message}`);
      callbacks.onError?.(err);
    });

    ws.on('close', (code, reason) => {
      this.logger.log(`STT WebSocket closed (code: ${code}, reason: ${reason})`);
      callbacks.onClose?.(code, reason.toString());
    });

    const sendAudioChunk = (pcmChunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN && isSessionReady) {
        // Enforce max 32,000 bytes chunk size per frame
        if (pcmChunk.length > 32000) {
          for (let offset = 0; offset < pcmChunk.length; offset += 32000) {
            const slice = pcmChunk.subarray(offset, offset + 32000);
            ws.send(JSON.stringify({ event: 'audio_input', audio: slice.toString('base64') }));
          }
        } else {
          ws.send(JSON.stringify({ event: 'audio_input', audio: pcmChunk.toString('base64') }));
        }
      } else if (ws.readyState === WebSocket.CONNECTING || !isSessionReady) {
        if (pendingChunks.length < 50) {
          pendingChunks.push(pcmChunk);
        }
      }
    };

    const close = () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };

    const isOpen = () => ws.readyState === WebSocket.OPEN;

    return { sendAudioChunk, close, isOpen };
  }
}
