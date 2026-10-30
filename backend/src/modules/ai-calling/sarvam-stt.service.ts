import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

export interface SttTranscriptionOptions {
  model?: string;
  mode?: 'transcribe' | 'translate' | 'verbatim' | 'translit' | 'codemix';
  languageCode?: string; // e.g. 'en-IN', 'hi-IN', 'te-IN'
  timeoutMs?: number;
}

export interface SttTranscriptionResult {
  success: boolean;
  transcript: string;
  languageCode: string;
  languageProbability?: number;
  requestId?: string;
  latencyMs: number;
  durationSeconds?: number;
}

@Injectable()
export class SarvamSttService {
  private readonly logger = new Logger(SarvamSttService.name);
  private readonly apiUrl = 'https://api.sarvam.ai/speech-to-text';
  private readonly defaultModel = 'saaras:v4';

  // Supported audio mime-types for Sarvam Saaras v4
  public static readonly SUPPORTED_MIME_TYPES = new Set([
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mpeg',
    'audio/mp3',
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg',
    'audio/opus',
    'audio/x-m4a',
    'audio/m4a',
    'audio/mp4',
    'audio/aac',
    'audio/flac',
  ]);

  // Max recording duration for Sarvam REST API is 30 seconds
  public static readonly MAX_DURATION_SECONDS = 30;
  // Max file size (10 MB)
  public static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

  /**
   * Securely retrieve the Sarvam API key without exposing it in logs or errors
   */
  private getApiKey(): string {
    const key = process.env.SARVAM_API_KEY?.trim();
    if (!key) {
      throw new UnauthorizedException(
        'SARVAM_API_KEY environment variable is not configured in backend/.env',
      );
    }
    return key;
  }

  /**
   * Transcribe an audio file buffer using Sarvam Saaras v4
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string,
    mimetype: string,
    options: SttTranscriptionOptions = {},
  ): Promise<SttTranscriptionResult> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new BadRequestException('Audio file buffer is empty or missing.');
    }

    if (audioBuffer.length > SarvamSttService.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `Audio file size (${(audioBuffer.length / (1024 * 1024)).toFixed(
          2,
        )} MB) exceeds maximum permitted limit of 10 MB.`,
      );
    }

    // Validate MIME type
    const normalizedMime = mimetype ? mimetype.toLowerCase().split(';')[0].trim() : '';
    const isValidMime =
      SarvamSttService.SUPPORTED_MIME_TYPES.has(normalizedMime) ||
      SarvamSttService.SUPPORTED_MIME_TYPES.has(mimetype.toLowerCase().trim()) ||
      filename.toLowerCase().endsWith('.wav') ||
      filename.toLowerCase().endsWith('.webm') ||
      filename.toLowerCase().endsWith('.mp3') ||
      filename.toLowerCase().endsWith('.m4a') ||
      filename.toLowerCase().endsWith('.ogg');

    if (!isValidMime) {
      throw new BadRequestException(
        `Unsupported audio format (${mimetype || filename}). Supported formats: WAV, WebM, MP3, M4A, OGG, FLAC.`,
      );
    }

    // Approximate duration check for WAV audio (16kHz 16-bit mono = 32000 bytes/sec)
    if (filename.toLowerCase().endsWith('.wav') && audioBuffer.length > 44) {
      try {
        const byteRate = audioBuffer.readUInt32LE(28);
        if (byteRate > 0) {
          const estimatedDuration = (audioBuffer.length - 44) / byteRate;
          if (estimatedDuration > SarvamSttService.MAX_DURATION_SECONDS + 2) {
            throw new BadRequestException(
              `Audio duration (~${Math.round(
                estimatedDuration,
              )}s) exceeds the REST API limit of ${SarvamSttService.MAX_DURATION_SECONDS} seconds.`,
            );
          }
        }
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
      }
    }

    const apiKey = this.getApiKey();
    const model = options.model || this.defaultModel;
    const mode = options.mode || 'transcribe';
    const timeoutMs = options.timeoutMs ?? 30000;
    const startTime = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([new Uint8Array(audioBuffer)], { type: mimetype || 'audio/wav' }),
        filename || 'speech_audio.wav',
      );
      formData.append('model', model);
      formData.append('mode', mode);

      if (options.languageCode) {
        formData.append('language_code', options.languageCode);
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errJson = await response.json();
          errorDetails =
            errJson.error?.message || errJson.message || JSON.stringify(errJson);
        } catch {
          errorDetails = await response.text();
        }

        if (response.status === 401 || response.status === 403) {
          throw new UnauthorizedException(
            `Sarvam STT authentication failed (HTTP ${response.status}): Invalid API key.`,
          );
        } else if (response.status === 429) {
          throw new HttpException(
            `Sarvam STT rate limit exceeded (HTTP 429). Please try again shortly.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        } else if (response.status === 400) {
          throw new BadRequestException(
            `Sarvam STT invalid audio: ${errorDetails}`,
          );
        } else {
          throw new HttpException(
            `Sarvam STT API error (HTTP ${response.status}): ${errorDetails}`,
            HttpStatus.BAD_GATEWAY,
          );
        }
      }

      const data = await response.json();
      const transcript = (data.transcript || '').trim();

      return {
        success: true,
        transcript,
        languageCode: data.language_code || options.languageCode || 'unknown',
        languageProbability: data.language_probability,
        requestId: data.request_id,
        latencyMs,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new HttpException(
          `Sarvam STT transcription request timed out after ${timeoutMs}ms.`,
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        `Failed to transcribe audio via Sarvam Saaras: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
