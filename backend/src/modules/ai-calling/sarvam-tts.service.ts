import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

export interface TtsSynthesisOptions {
  model?: string;
  languageCode?: string; // 'en-IN' | 'hi-IN' | 'te-IN'
  speaker?: string;
  pace?: number; // 0.5 to 2.0
  outputAudioCodec?: 'wav' | 'mp3';
  speechSampleRate?: number;
  enablePreprocessing?: boolean;
  timeoutMs?: number;
}

export interface TtsSynthesisResult {
  success: boolean;
  audioBase64: string;
  audioMimeType: string;
  latencyMs: number;
  speaker: string;
  languageCode: string;
  characterCount: number;
  requestId?: string;
}

// Curated persona catalog mapping for bulbul:v4-flash
export const RECOMMENDED_VOICES: Record<
  string,
  { id: string; name: string; gender: 'female' | 'male'; description: string }[]
> = {
  'en-IN': [
    {
      id: 'simran_en_customer',
      name: 'Simran',
      gender: 'female',
      description: 'Customer Support & Conversational',
    },
    {
      id: 'dev_en_conversational',
      name: 'Dev',
      gender: 'male',
      description: 'Conversational & Professional',
    },
    {
      id: 'shubh_enhi_ads',
      name: 'Shubh',
      gender: 'male',
      description: 'Commercial & Warm (Bilingual)',
    },
    {
      id: 'ishita_en_customer',
      name: 'Ishita',
      gender: 'female',
      description: 'Clear Customer Support',
    },
  ],
  'hi-IN': [
    {
      id: 'kavya_hi_conversational',
      name: 'Kavya',
      gender: 'female',
      description: 'Natural Spoken Hindi',
    },
    {
      id: 'aditya_hi_conversational',
      name: 'Aditya',
      gender: 'male',
      description: 'Conversational Hindi Executive',
    },
    {
      id: 'ritu_hi_customer',
      name: 'Ritu',
      gender: 'female',
      description: 'Polite Support Hindi',
    },
    {
      id: 'shubh_hi_customer',
      name: 'Shubh',
      gender: 'male',
      description: 'Customer Calling Hindi',
    },
  ],
  'te-IN': [
    {
      id: 'kavitha_te_conversation',
      name: 'Kavitha',
      gender: 'female',
      description: 'Conversational Telugu (Natural)',
    },
    {
      id: 'pooja_te_conversation',
      name: 'Pooja',
      gender: 'female',
      description: 'Polite Telugu Caller',
    },
    {
      id: 'tarun_te_narration',
      name: 'Tarun',
      gender: 'male',
      description: 'Clear Telugu Narration',
    },
  ],
  'kn-IN': [
    {
      id: 'chaitra_kn_conversation',
      name: 'Chaitra',
      gender: 'female',
      description: 'Conversational Kannada (Natural)',
    },
    {
      id: 'chetan_kn_conversation',
      name: 'Chetan',
      gender: 'male',
      description: 'Conversational Kannada Executive',
    },
    {
      id: 'chaitra_kn_narration',
      name: 'Chaitra (Narration)',
      gender: 'female',
      description: 'Clear Kannada Narration',
    },
    {
      id: 'suchitra_kn_narration',
      name: 'Suchitra',
      gender: 'female',
      description: 'Polite Kannada Narration',
    },
  ],
};

@Injectable()
export class SarvamTtsService {
  private readonly logger = new Logger(SarvamTtsService.name);
  private readonly apiUrl = 'https://api.sarvam.ai/text-to-speech';
  private readonly defaultModel = 'bulbul:v4-flash';
  public static readonly MAX_CHARACTERS = 2500;

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
   * Convert text into natural speech audio using Sarvam Bulbul v4 Flash
   */
  async synthesizeSpeech(
    text: string,
    options: TtsSynthesisOptions = {},
  ): Promise<TtsSynthesisResult> {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Text to synthesize cannot be empty.');
    }

    if (trimmed.length > SarvamTtsService.MAX_CHARACTERS) {
      throw new BadRequestException(
        `Text exceeds the maximum limit of ${SarvamTtsService.MAX_CHARACTERS} characters (received ${trimmed.length} characters).`,
      );
    }

    const apiKey = this.getApiKey();
    const model = options.model || this.defaultModel;
    const languageCode = options.languageCode || 'en-IN';
    const outputCodec = options.outputAudioCodec || 'wav';
    const timeoutMs = options.timeoutMs ?? 30000;

    // Resolve default speaker based on language if not explicitly provided
    let speaker = options.speaker;
    if (!speaker) {
      const available = RECOMMENDED_VOICES[languageCode];
      speaker = available?.[0]?.id || 'shubh_enhi_ads';
    }

    // Validate pace range
    let pace = options.pace ?? 1.0;
    if (pace < 0.5 || pace > 2.0) {
      pace = Math.min(Math.max(pace, 0.5), 2.0);
    }

    const payload = {
      text: trimmed,
      model,
      speaker,
      language_code: languageCode,
      output_audio_codec: outputCodec,
      pace,
      enable_preprocessing: options.enablePreprocessing ?? true,
      ...(options.speechSampleRate
        ? { speech_sample_rate: options.speechSampleRate }
        : {}),
    };

    const startTime = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errJson = await response.json();
          errorDetails =
            errJson.message ||
            errJson.error?.message ||
            errJson.error ||
            JSON.stringify(errJson);
        } catch {
          errorDetails = await response.text();
        }

        if (response.status === 401 || response.status === 403) {
          throw new UnauthorizedException(
            `Sarvam TTS authentication failed (HTTP ${response.status}): Invalid API key.`,
          );
        } else if (response.status === 429) {
          throw new HttpException(
            `Sarvam TTS rate limit exceeded (HTTP 429). Please try again shortly.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        } else if (response.status === 400) {
          throw new BadRequestException(
            `Sarvam TTS request invalid: ${errorDetails}`,
          );
        } else {
          throw new HttpException(
            `Sarvam TTS API error (HTTP ${response.status}): ${errorDetails}`,
            HttpStatus.BAD_GATEWAY,
          );
        }
      }

      const data = await response.json();
      const audioBase64 = data.audios?.[0];

      if (!audioBase64) {
        throw new HttpException(
          'Sarvam TTS response did not contain audio data.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        success: true,
        audioBase64,
        audioMimeType: outputCodec === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        latencyMs,
        speaker,
        languageCode,
        characterCount: trimmed.length,
        requestId: data.request_id,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new HttpException(
          `Sarvam TTS request timed out after ${timeoutMs}ms.`,
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        `Failed to synthesize speech via Sarvam Bulbul: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Return available curated voice personas for the frontend
   */
  getAvailableVoices(languageCode = 'en-IN') {
    return RECOMMENDED_VOICES[languageCode] || RECOMMENDED_VOICES['en-IN'];
  }
}
