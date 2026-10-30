import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  SarvamStreamingSttService,
  StreamingSttOptions,
} from './sarvam-streaming-stt.service.js';
import {
  SarvamStreamingTtsService,
  StreamingTtsConfig,
} from './sarvam-streaming-tts.service.js';
import {
  SarvamStreamingLlmService,
  ChatMessage,
} from './sarvam-streaming-llm.service.js';
import { SupportedLanguage } from './sarvam-conversation.service.js';

export type VoiceSessionState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'PROCESSING'
  | 'AI_SPEAKING'
  | 'INTERRUPTED'
  | 'ENDING'
  | 'ENDED'
  | 'ERROR';

export interface VoiceOrchestratorConfig {
  sessionId?: string;
  clientId: string;
  language?: SupportedLanguage;
  speaker?: string;
  onClientEmit: (event: any) => void;
}

export interface ActiveVoiceTurn {
  turnId: string;
  userText?: string;
  aiText?: string;
  startedAt: number;
  speechEndAt?: number;
  llmFirstTokenAt?: number;
  ttsFirstAudioAt?: number;
  completedAt?: number;
}

@Injectable()
export class VoiceConversationOrchestratorService {
  private readonly logger = new Logger(VoiceConversationOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sttService: SarvamStreamingSttService,
    private readonly ttsService: SarvamStreamingTtsService,
    private readonly llmService: SarvamStreamingLlmService,
  ) {}

  /**
   * Start a real-time full-duplex voice conversation session
   */
  async startVoiceSession(config: VoiceOrchestratorConfig) {
    const sessionId = config.sessionId || `voice_sim_${randomUUID()}`;
    const clientId = config.clientId;

    // Map language to BCP-47 tag for STT/TTS
    const langCodeMap: Record<SupportedLanguage, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      te: 'te-IN',
      kn: 'kn-IN',
    };
    let language: SupportedLanguage = config.language || 'en';
    let bcp47Lang = langCodeMap[language] || 'en-IN';

    // Default voice persona per language
    const defaultSpeakerMap: Record<SupportedLanguage, string> = {
      en: 'simran_en_customer',
      hi: 'kavya_hi_conversational',
      te: 'kavitha_te_conversation',
      kn: 'chaitra_kn_conversation',
    };
    let speaker = config.speaker || defaultSpeakerMap[language];

    // Fetch tenant company name
    let companyName = 'Our Company';
    try {
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true },
      });
      if (client?.name) {
        companyName = client.name;
      }
    } catch (e: any) {
      this.logger.warn(`Could not fetch company name for ${clientId}: ${e.message}`);
    }

    let state: VoiceSessionState = 'CONNECTING';
    const messages: ChatMessage[] = [];
    let currentTurn: ActiveVoiceTurn | null = null;
    let activeLlmAbort: AbortController | null = null;
    let activeTtsSession: {
      sendText: (text: string) => void;
      flush: () => void;
      abort: () => void;
      isOpen: () => boolean;
    } | null = null;

    const emit = (event: any) => {
      config.onClientEmit(event);
    };

    const setState = (newState: VoiceSessionState) => {
      state = newState;
      emit({ type: 'state_change', state: newState, sessionId });
    };

    // Prepare system instructions
    const systemPrompt = `You are an AI Voice Calling Assistant representing "${companyName}".
Rules for voice conversation:
1. Speak in a natural, polite, and human voice.
2. Keep responses very short and conversational (1 to 2 short sentences).
3. Always ask one single clear question at a time.
4. Do not recite long bullet points or multiple options.
5. Language: Strictly respond in ${language === 'hi' ? 'Hindi' : language === 'te' ? 'Telugu' : language === 'kn' ? 'Kannada' : 'Indian English'}.
6. If the user wants a callback, note their preference politely.
7. If the user wants to opt out or stop calling, confirm and apologize politely.`;

    messages.push({ role: 'system', content: systemPrompt });

    // Handle user interruption (barge-in)
    const handleBargeIn = (reason = 'user_started_speaking') => {
      if (state === 'PROCESSING' || state === 'AI_SPEAKING') {
        this.logger.log(`Barge-in triggered (${reason}). Aborting current AI generation & playback.`);

        if (activeLlmAbort) {
          activeLlmAbort.abort();
          activeLlmAbort = null;
        }

        if (activeTtsSession) {
          activeTtsSession.abort();
          activeTtsSession = null;
        }

        const turnId = currentTurn?.turnId || 'unknown';
        setState('INTERRUPTED');
        emit({ type: 'interrupted', turnId, reason });
      }
    };

    // Initialize Streaming STT
    const sttCallbacks = {
      onSessionBegin: () => {
        this.logger.log(`Voice session ${sessionId}: STT Session ready.`);
      },
      onSpeechStart: (confidence: number) => {
        this.logger.debug(`VAD speech start detected (${confidence}).`);
        handleBargeIn('speech_start');
        setState('USER_SPEAKING');
        emit({ type: 'user_speech_start', confidence, sessionId });
      },
      onPartialTranscript: (text: string, utteranceIdx: number) => {
        if (!text) return;
        setState('USER_SPEAKING');
        emit({ type: 'partial_transcript', text, utteranceIdx, sessionId });
      },
      onSpeechEnd: () => {
        this.logger.debug('VAD speech end detected.');
        emit({ type: 'user_speech_end', sessionId });
      },
      onFinalTranscript: async (text: string, utteranceIdx: number) => {
        const trimmed = (text || '').trim();
        if (!trimmed) {
          if (state === 'USER_SPEAKING') {
            setState('LISTENING');
          }
          return;
        }

        this.logger.log(`Voice turn final user text: "${trimmed}"`);
        emit({ type: 'final_transcript', text: trimmed, utteranceIdx, sessionId });

        // Process conversational turn with LLM and TTS
        await executeVoiceTurn(trimmed);
      },
      onError: (err: any) => {
        this.logger.error(`STT session error: ${err.message || JSON.stringify(err)}`);
        emit({ type: 'error', component: 'STT', error: err.message || 'STT error' });
      },
      onClose: (code: number, reason: string) => {
        this.logger.log(`STT session closed: ${code} - ${reason}`);
      },
    };

    let sttSession = this.sttService.createSession(
      { languageCode: bcp47Lang, sampleRate: 16000, streamType: 'balanced' },
      sttCallbacks,
    );

    // Turn execution function (LLM + TTS)
    const executeVoiceTurn = async (userText: string) => {
      // Guard against overlapping turns
      if (activeLlmAbort) {
        activeLlmAbort.abort();
      }
      if (activeTtsSession) {
        activeTtsSession.abort();
      }

      const turnId = `turn_${randomUUID()}`;
      const startedAt = Date.now();
      currentTurn = { turnId, userText, startedAt };

      setState('PROCESSING');
      emit({ type: 'turn_start', turnId, userText });

      messages.push({ role: 'user', content: userText });

      // Create new TTS session for this turn
      const turnAudioBuffers: Buffer[] = [];
      const ttsCallbacks = {
        onAudioChunk: (base64Audio: string) => {
          const chunkBuf = Buffer.from(base64Audio, 'base64');
          turnAudioBuffers.push(chunkBuf);

          const turn = currentTurn;
          if (turn && !turn.ttsFirstAudioAt) {
            turn.ttsFirstAudioAt = Date.now();
            const ttsLatency = turn.ttsFirstAudioAt - turn.startedAt;
            emit({ type: 'latency_metric', metric: 'tts_first_audio_ms', value: ttsLatency, turnId });
          }
          if (state !== 'AI_SPEAKING' && state !== 'INTERRUPTED') {
            setState('AI_SPEAKING');
          }
          emit({ type: 'audio_chunk', audio: base64Audio, turnId });
        },
        onCompletion: () => {
          this.logger.log(`TTS generation finished for turn ${turnId}, total frames: ${turnAudioBuffers.length}`);
          if (turnAudioBuffers.length > 0) {
            const fullWav = Buffer.concat(turnAudioBuffers);
            // Patch WAV RIFF header sizes if valid WAV
            if (fullWav.length >= 44 && fullWav.toString('ascii', 0, 4) === 'RIFF') {
              fullWav.writeUInt32LE(fullWav.length - 8, 4);
              fullWav.writeUInt32LE(fullWav.length - 44, 40);
            }
            emit({
              type: 'audio_ready',
              audio: fullWav.toString('base64'),
              turnId,
              byteLength: fullWav.length,
              durationMs: Math.round(((fullWav.length - 44) / (22050 * 2)) * 1000),
            });
          }
          emit({ type: 'tts_completion', turnId });
        },
        onError: (err: any) => {
          this.logger.error(`TTS turn error: ${JSON.stringify(err)}`);
          emit({ type: 'error', component: 'TTS', error: err.message || 'TTS Error' });
        },
      };

      activeTtsSession = this.ttsService.createSession(
        { languageCode: bcp47Lang, speaker, outputAudioCodec: 'wav' },
        ttsCallbacks,
      );

      // Create LLM stream
      activeLlmAbort = new AbortController();
      let accumulatedAiText = '';

      try {
        await this.llmService.streamChatCompletion(
          messages,
          {
            onTokenChunk: (delta: string) => {
              const turn = currentTurn;
              if (turn && !turn.llmFirstTokenAt) {
                turn.llmFirstTokenAt = Date.now();
                const llmLatency = turn.llmFirstTokenAt - turn.startedAt;
                emit({ type: 'latency_metric', metric: 'llm_first_token_ms', value: llmLatency, turnId });
              }
              emit({ type: 'ai_text_chunk', delta, turnId });
            },

            onSentence: (sentence: string) => {
              this.logger.debug(`LLM Sentence generated: "${sentence}"`);
              activeTtsSession?.sendText(sentence);
            },
            onComplete: (fullText: string) => {
              accumulatedAiText = fullText;
              this.logger.log(`LLM Completed turn ${turnId}: "${fullText}"`);
              messages.push({ role: 'assistant', content: fullText });
              activeTtsSession?.flush();
              emit({ type: 'ai_turn_final', text: fullText, turnId });
            },
            onError: (err: any) => {
              this.logger.error(`LLM error on turn ${turnId}: ${err.message}`);
              emit({ type: 'error', component: 'LLM', error: err.message });
            },
          },
          activeLlmAbort.signal,
        );
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          this.logger.error(`Error in executeVoiceTurn: ${err.message}`);
        }
      } finally {
        activeLlmAbort = null;
      }
    };

    // Send Initial AI Introductory Greeting
    const sendInitialGreeting = async () => {
      setState('PROCESSING');
      const turnId = `greeting_${randomUUID()}`;
      currentTurn = { turnId, startedAt: Date.now() };

      const greetingText =
        language === 'hi'
          ? `नमस्ते! मैं ${companyName} से आपका एआई कॉलिंग असिस्टेंट हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?`
          : language === 'te'
          ? `నమస్కారం! నేను ${companyName} నుండి మీ AI కాలింగ్ అసిస్టెంట్‌ని. ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?`
          : language === 'kn'
          ? `ನಮಸ್ಕಾರ! ನಾನು ${companyName} ಇಂದ ನಿಮ್ಮ AI ಕಾಲಿಂಗ್ ಅಸಿಸ್ಟೆಂಟ್. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`
          : `Hello! I am your AI assistant from ${companyName}. How can I assist you today?`;

      emit({ type: 'ai_turn_final', text: greetingText, turnId, isGreeting: true });
      messages.push({ role: 'assistant', content: greetingText });

      const greetingAudioBuffers: Buffer[] = [];
      activeTtsSession = this.ttsService.createSession(
        { languageCode: bcp47Lang, speaker, outputAudioCodec: 'wav' },
        {
          onAudioChunk: (base64Audio) => {
            greetingAudioBuffers.push(Buffer.from(base64Audio, 'base64'));
            if (state !== 'AI_SPEAKING') {
              setState('AI_SPEAKING');
            }
            emit({ type: 'audio_chunk', audio: base64Audio, turnId });
          },
          onCompletion: () => {
            this.logger.log(`TTS greeting finished for turn ${turnId}, total frames: ${greetingAudioBuffers.length}`);
            if (greetingAudioBuffers.length > 0) {
              const fullWav = Buffer.concat(greetingAudioBuffers);
              if (fullWav.length >= 44 && fullWav.toString('ascii', 0, 4) === 'RIFF') {
                fullWav.writeUInt32LE(fullWav.length - 8, 4);
                fullWav.writeUInt32LE(fullWav.length - 44, 40);
              }
              emit({
                type: 'audio_ready',
                audio: fullWav.toString('base64'),
                turnId,
                text: greetingText,
                byteLength: fullWav.length,
                durationMs: Math.round(((fullWav.length - 44) / (22050 * 2)) * 1000),
              });
            }
            emit({ type: 'tts_completion', turnId });
          },
          onError: (err) => {
            this.logger.error(`Greeting TTS error: ${JSON.stringify(err)}`);
            setState('LISTENING');
          },
        },
      );

      activeTtsSession.sendText(greetingText);
      activeTtsSession.flush();
    };

    // Trigger initial greeting once connection is established
    setTimeout(() => {
      sendInitialGreeting();
    }, 500);

    return {
      sessionId,
      getState: () => state,
      receivePcmAudio: (pcmBuffer: Buffer) => {
        if (state !== 'ENDED') {
          sttSession.sendAudioChunk(pcmBuffer);
        }
      },
      notifyPlaybackFinished: (turnId: string) => {
        if (state !== 'ENDED') {
          this.logger.log(`Client playback finished for turn ${turnId}. Transitioning to LISTENING.`);
          setState('LISTENING');
        }
      },
      interrupt: () => {
        handleBargeIn('client_manual_interrupt');
      },
      switchLanguage: (newLang: SupportedLanguage, newSpeaker?: string) => {
        if (!['en', 'hi', 'te', 'kn'].includes(newLang)) return;
        this.logger.log(`Switching voice session ${sessionId} language from ${language} to ${newLang}`);
        language = newLang;
        bcp47Lang = langCodeMap[newLang] || 'en-IN';
        speaker = newSpeaker || defaultSpeakerMap[newLang];

        // Reconnect STT with new language
        sttSession.close();
        sttSession = this.sttService.createSession(
          { languageCode: bcp47Lang, sampleRate: 16000, streamType: 'balanced' },
          sttCallbacks,
        );

        const langName =
          newLang === 'hi'
            ? 'Hindi'
            : newLang === 'te'
            ? 'Telugu'
            : newLang === 'kn'
            ? 'Kannada'
            : 'Indian English';

        messages.push({
          role: 'system',
          content: `[Language Switched to ${langName}]: The user has switched the conversation language to ${langName}. Please converse strictly in natural, polite ${langName} (${newLang === 'en' ? 'English' : 'native script'}) from now on while remembering all earlier conversation details.`,
        });

        emit({
          type: 'language_switched',
          language: newLang,
          bcp47: bcp47Lang,
          bcp47Lang,
          speaker,
          sessionId,
        });
      },
      endSession: () => {
        this.logger.log(`Ending voice session ${sessionId}`);
        if (activeLlmAbort) activeLlmAbort.abort();
        if (activeTtsSession) activeTtsSession.abort();
        sttSession.close();
        setState('ENDED');
        emit({ type: 'session_ended', sessionId });
      },
    };
  }
}
