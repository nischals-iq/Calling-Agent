'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  RotateCcw,
  Bot,
  User,
  Sparkles,
  Zap,
  Globe,
  AlertCircle,
  Clock,
  UserCheck,
  PhoneOff,
  ThumbsUp,
  MessageSquare,
  Mic,
  MicOff,
  Upload,
  Radio,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  Square,
  Loader2,
  Activity,
  Play,
  Pause,
} from 'lucide-react';
import { apiFetch, getStoredToken } from '../../lib/api';

export type SupportedLanguage = 'en' | 'hi' | 'te' | 'kn';
export type PlaygroundMode = 'MANUAL' | 'LIVE_VOICE';

export interface PlaygroundMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  durationMs?: number;
}

export interface PlaygroundSession {
  id: string;
  clientId: string;
  companyName: string;
  language: SupportedLanguage;
  status: 'ACTIVE' | 'ENDED';
  detectedIntent: string;
  lastLatencyMs?: number;
  messages: PlaygroundMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface VoicePersona {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
}

export type LiveVoiceState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'PROCESSING'
  | 'AI_SPEAKING'
  | 'INTERRUPTED'
  | 'ENDED'
  | 'ERROR';

const LANGUAGE_OPTIONS: { code: SupportedLanguage; label: string; native: string; sttCode: string }[] = [
  { code: 'en', label: 'English', native: 'English', sttCode: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', sttCode: 'hi-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', sttCode: 'te-IN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', sttCode: 'kn-IN' },
];

export const BULBUL_VOICES: Record<SupportedLanguage, VoicePersona[]> = {
  en: [
    { id: 'simran_en_customer', name: 'Simran (Female)', gender: 'female', description: 'Customer Support' },
    { id: 'dev_en_conversational', name: 'Dev (Male)', gender: 'male', description: 'Conversational' },
    { id: 'shubh_enhi_ads', name: 'Shubh (Male)', gender: 'male', description: 'Commercial & Warm' },
    { id: 'ishita_en_customer', name: 'Ishita (Female)', gender: 'female', description: 'Clear Support' },
  ],
  hi: [
    { id: 'kavya_hi_conversational', name: 'Kavya (Female)', gender: 'female', description: 'Natural Spoken Hindi' },
    { id: 'aditya_hi_conversational', name: 'Aditya (Male)', gender: 'male', description: 'Executive Hindi' },
    { id: 'ritu_hi_customer', name: 'Ritu (Female)', gender: 'female', description: 'Polite Support' },
    { id: 'shubh_hi_customer', name: 'Shubh (Male)', gender: 'male', description: 'Calling Hindi' },
  ],
  te: [
    { id: 'kavitha_te_conversation', name: 'Kavitha (Female)', gender: 'female', description: 'Conversational Telugu' },
    { id: 'pooja_te_conversation', name: 'Pooja (Female)', gender: 'female', description: 'Polite Telugu Caller' },
    { id: 'tarun_te_narration', name: 'Tarun (Male)', gender: 'male', description: 'Clear Telugu Narration' },
  ],
  kn: [
    { id: 'chaitra_kn_conversation', name: 'Chaitra (Female)', gender: 'female', description: 'Conversational Kannada (Natural)' },
    { id: 'chetan_kn_conversation', name: 'Chetan (Male)', gender: 'male', description: 'Executive Kannada (Male)' },
    { id: 'chaitra_kn_narration', name: 'Chaitra (Narration)', gender: 'female', description: 'Clear Kannada Narration' },
    { id: 'suchitra_kn_narration', name: 'Suchitra (Female)', gender: 'female', description: 'Polite Kannada Narration' },
  ],
};

const SUGGESTED_PROMPTS: Record<SupportedLanguage, { label: string; text: string }[]> = {
  en: [
    { label: '👋 Introduce', text: 'Hello, what services does your company provide?' },
    { label: '🛡️ Test Pricing Guardrail', text: 'Can you guarantee me a price of 99 rupees for the complete package?' },
    { label: '⏰ Request Callback', text: 'I am busy right now, could you please call me back tomorrow at 3 PM?' },
    { label: '👤 Request Human Agent', text: 'Can I please speak directly to a real human manager?' },
    { label: '🚫 Test Opt-Out (DNC)', text: 'Do not call me again. Please remove my number from your list.' },
  ],
  hi: [
    { label: '👋 परिचय', text: 'नमस्ते, आपकी कंपनी क्या सेवाएँ प्रदान करती है?' },
    { label: '🛡️ मूल्य सुरक्षा', text: 'क्या आप मुझे पूरी सेवा के लिए 99 रुपये की गारंटी दे सकते हैं?' },
    { label: '⏰ दोबारा कॉल', text: 'मैं अभी व्यस्त हूँ, क्या आप कल दोपहर 3 बजे कॉल कर सकते हैं?' },
    { label: '👤 मानव प्रतिनिधि', text: 'क्या मैं किसी मानव प्रबंधक से बात कर सकता हूँ?' },
    { label: '🚫 कॉल न करें (DNC)', text: 'मुझे दोबारा कॉल मत करो। मेरा नंबर हटा दें।' },
  ],
  te: [
    { label: '👋 పరిచయం', text: 'నమస్కారం, మీ కంపెనీ ఏ సేవలను అందిస్తుంది?' },
    { label: '🛡️ ధర ధృవీకరణ', text: 'మీరు మొత్తం ప్యాకేజీ కోసం నాకు 99 రూపాయల ధరను హామీ ఇవ్వగలరా?' },
    { label: '⏰ తర్వాత కాల్', text: 'నేను ఇప్పుడు బిజీగా ఉన్నాను, రేపు మధ్యాహ్నం 3 గంటలకు కాల్ చేయగలరా?' },
    { label: '👤 మేనేజర్‌తో మాట్లాడండి', text: 'నేను ఒక నిజమైన హ్యూమన్ మేనేజర్‌తో మాట్లాడవచ్చా?' },
    { label: '🚫 కాల్ చేయవద్దు (DNC)', text: 'నాకు మళ్ళీ కాల్ చేయవద్దు. నా నంబర్‌ను తొలగించండి.' },
  ],
  kn: [
    { label: '👋 ಪರಿಚಯ', text: 'ನಮಸ್ಕಾರ, ನಿಮ್ಮ ಕಂಪನಿ ಯಾವ ಸೇವೆಗಳನ್ನು ಒದಗಿಸುತ್ತದೆ?' },
    { label: '🛡️ ಬೆಲೆ ಗ್ಯಾರಂಟಿ', text: 'ಸಂಪೂರ್ಣ ಪ್ಯಾಕೇಜ್‌ಗಾಗಿ ನೀವು ನನಗೆ 99 ರೂಪಾಯಿಗಳ ಬೆಲೆಯನ್ನು ಖಾತರಿಪಡಿಸಬಹುದೇ?' },
    { label: '⏰ ನಂತರ ಕರೆ ಮಾಡಿ', text: 'ನಾನು ಈಗ ಬ್ಯುಸಿಯಾಗಿದ್ದೇನೆ, ದಯವಿಟ್ಟು ನಾಳೆ ಮಧ್ಯಾಹ್ನ 3 ಗಂಟೆಗೆ ಕರೆ ಮಾಡಬಹುದೇ?' },
    { label: '👤 ಮಾನವ ಪ್ರತಿನಿಧಿ', text: 'ನಾನು ನೇರವಾಗಿ ನಿಜವಾದ ಹ್ಯೂಮನ್ ಮ್ಯಾನೇಜರ್ ಜೊತೆ ಮಾತನಾಡಬಹುದೇ?' },
    { label: '🚫 ಕರೆ ಮಾಡಬೇಡಿ (DNC)', text: 'ನನಗೆ ಮತ್ತೆ ಕರೆ ಮಾಡಬೇಡಿ. ದಯವಿಟ್ಟು ನನ್ನ ನಂಬರ್ ಪಟ್ಟಿಯಿಂದ ತೆಗೆದುಹಾಕಿ.' },
  ],
};

export default function ConversationPlayground() {
  const [activeMode, setActiveMode] = useState<PlaygroundMode>('LIVE_VOICE');
  const [session, setSession] = useState<PlaygroundSession | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode A: Speech-to-Text Recording & Upload States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttMetadata, setSttMetadata] = useState<{
    languageCode?: string;
    latencyMs?: number;
    filename?: string;
  } | null>(null);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  // Text-to-Speech (Bulbul v4-flash) States
  const [selectedVoice, setSelectedVoice] = useState<string>(BULBUL_VOICES.en[0].id);
  const [autoPlayTts, setAutoPlayTts] = useState<boolean>(false);
  const [speechPace, setSpeechPace] = useState<number>(1.0);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [synthesizingMessageId, setSynthesizingMessageId] = useState<string | null>(null);
  const [ttsLatencyMap, setTtsLatencyMap] = useState<Record<string, number>>({});

  // -------------------------------------------------------------
  // Mode B: Real-Time Live Voice Conversation Engine States
  // -------------------------------------------------------------
  const [liveVoiceState, setLiveVoiceState] = useState<LiveVoiceState>('IDLE');
  const [livePartialTranscript, setLivePartialTranscript] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [liveMessages, setLiveMessages] = useState<PlaygroundMessage[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<{
    llmFirstTokenMs?: number;
    ttsFirstAudioMs?: number;
    lastTurnLatencyMs?: number;
  }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveMessagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Playback references
  const audioCacheRef = useRef<Record<string, string>>({});
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Live Voice Web Audio & WebSocket References
  const voiceWsRef = useRef<WebSocket | null>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);
  const liveMediaStreamRef = useRef<MediaStream | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const activePlaybackAudioRef = useRef<HTMLAudioElement | null>(null);
  const turnAudioAccumulatorRef = useRef<string[]>([]);
  const voicePingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    liveMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, liveMessages, livePartialTranscript, loading, isTranscribing]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      stopCurrentAudio();
      handleEndLiveVoice();
    };
  }, []);

  // Update voice persona on language change
  useEffect(() => {
    const voices = BULBUL_VOICES[selectedLanguage];
    if (voices && voices.length > 0) {
      const exists = voices.some((v) => v.id === selectedVoice);
      if (!exists) {
        setSelectedVoice(voices[0].id);
      }
    }
  }, [selectedLanguage]);

  // Stop active playback in Mode A
  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      currentAudioRef.current = null;
    }
    setPlayingMessageId(null);
  };

  const playAudioData = (dataUri: string, messageId: string) => {
    stopCurrentAudio();
    try {
      const audio = new Audio(dataUri);
      currentAudioRef.current = audio;
      setPlayingMessageId(messageId);

      audio.onended = () => {
        setPlayingMessageId(null);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingMessageId(null);
        currentAudioRef.current = null;
        setError('Failed to play synthesized audio.');
      };

      audio.play().catch((err) => {
        console.warn('Audio play was prevented or failed:', err);
        setPlayingMessageId(null);
      });
    } catch (e: any) {
      console.error('Playback exception:', e);
      setPlayingMessageId(null);
      setError(`Audio playback error: ${e.message}`);
    }
  };

  const handlePlayMessage = async (msg: PlaygroundMessage) => {
    if (playingMessageId === msg.id) {
      stopCurrentAudio();
      return;
    }

    const cachedUri = audioCacheRef.current[msg.id];
    if (cachedUri) {
      playAudioData(cachedUri, msg.id);
      return;
    }

    setSynthesizingMessageId(msg.id);
    setError(null);

    try {
      const targetLang =
        LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage)?.sttCode ||
        'en-IN';

      const result = await apiFetch<{
        success: boolean;
        audioBase64: string;
        audioMimeType: string;
        latencyMs: number;
        speaker: string;
        characterCount: number;
        requestId?: string;
      }>('/client/ai-calling/speech/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          text: msg.content,
          languageCode: targetLang,
          speaker: selectedVoice,
          pace: speechPace,
          outputAudioCodec: 'wav',
        }),
      });

      const dataUri = `data:${result.audioMimeType || 'audio/wav'};base64,${result.audioBase64}`;
      audioCacheRef.current[msg.id] = dataUri;
      setTtsLatencyMap((prev) => ({ ...prev, [msg.id]: result.latencyMs }));
      playAudioData(dataUri, msg.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to synthesize speech via Sarvam Bulbul.');
    } finally {
      setSynthesizingMessageId(null);
    }
  };

  // Start new conversation in Mode A
  const handleStartConversation = async (lang: SupportedLanguage = selectedLanguage) => {
    stopCurrentAudio();
    setStarting(true);
    setError(null);
    setSttMetadata(null);
    audioCacheRef.current = {};
    setTtsLatencyMap({});

    try {
      const newSession = await apiFetch<PlaygroundSession>(
        '/client/ai-calling/conversations/start',
        {
          method: 'POST',
          body: JSON.stringify({ language: lang }),
        },
      );
      setSession(newSession);
      setSelectedLanguage(lang);

      if (autoPlayTts && newSession?.messages) {
        const firstAssistant = newSession.messages.find((m) => m.role === 'assistant');
        if (firstAssistant) {
          setTimeout(() => {
            handlePlayMessage(firstAssistant);
          }, 200);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to start conversation with Sarvam LLM.');
    } finally {
      setStarting(false);
    }
  };

  // Send message in Mode A
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText ?? inputMessage;
    if (!textToSend.trim() || !session || loading) return;

    if (session.status === 'ENDED') {
      setError('This conversation has ended. Please click "Start New Conversation".');
      return;
    }

    stopCurrentAudio();
    setLoading(true);
    setError(null);
    setInputMessage('');
    setSttMetadata(null);

    try {
      const result = await apiFetch<{
        session: PlaygroundSession;
        aiResponse: string;
        detectedIntent: string;
        latencyMs: number;
      }>(`/client/ai-calling/conversations/${session.id}/message`, {
        method: 'POST',
        body: JSON.stringify({ message: textToSend }),
      });

      setSession(result.session);

      if (autoPlayTts && result.session.messages) {
        const lastAiMsg = result.session.messages
          .filter((m) => m.role === 'assistant')
          .slice(-1)[0];
        if (lastAiMsg) {
          setTimeout(() => {
            handlePlayMessage(lastAiMsg);
          }, 150);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send message to Sarvam LLM.');
    } finally {
      setLoading(false);
    }
  };

  // Reset conversation in Mode A
  const handleReset = async () => {
    stopCurrentAudio();
    if (isRecording) {
      handleCancelRecording();
    }
    if (session) {
      try {
        await apiFetch(`/client/ai-calling/conversations/${session.id}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore deletion errors on reset
      }
    }
    setSession(null);
    setError(null);
    setSttMetadata(null);
    setInputMessage('');
    audioCacheRef.current = {};
    setTtsLatencyMap({});
  };

  // Mode A: Mic Recording Handlers
  const handleStartRecording = async () => {
    stopCurrentAudio();
    setMicPermissionError(null);
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicPermissionError('Microphone audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          await transcribeAudioBlob(audioBlob, 'mic_recording.webm', mimeType);
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 29) {
            handleStopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermissionError(
          'Microphone permission was denied. Please allow microphone access in your browser settings to speak.',
        );
      } else {
        setMicPermissionError(`Could not access microphone: ${err.message}`);
      }
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const handleCancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 10 * 1024 * 1024) {
      setError(
        `Selected audio file is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is 10 MB.`,
      );
      return;
    }
    await transcribeAudioBlob(file, file.name, file.type || 'audio/wav');
  };

  const transcribeAudioBlob = async (
    blobOrFile: Blob | File,
    filename: string,
    mimetype: string,
  ) => {
    setIsTranscribing(true);
    setError(null);
    setSttMetadata(null);

    try {
      const formData = new FormData();
      formData.append('file', blobOrFile, filename);

      const targetLang = LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage);
      if (targetLang?.sttCode) {
        formData.append('languageCode', targetLang.sttCode);
      }
      formData.append('mode', 'transcribe');

      const result = await apiFetch<{
        success: boolean;
        transcript: string;
        languageCode: string;
        latencyMs: number;
        requestId?: string;
      }>('/client/ai-calling/speech/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!result.transcript || result.transcript.trim().length === 0) {
        setError('No speech could be recognized in the audio recording. Please speak clearly and try again.');
      } else {
        setInputMessage(result.transcript);
        setSttMetadata({
          languageCode: result.languageCode,
          latencyMs: result.latencyMs,
          filename,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to transcribe audio with Sarvam Saaras.');
    } finally {
      setIsTranscribing(false);
      setRecordingSeconds(0);
    }
  };

  // -------------------------------------------------------------
  // Mode B: Full-Duplex Real-Time Voice Streaming Engine
  // -------------------------------------------------------------
  const handleStartLiveVoice = async () => {
    setError(null);
    setMicPermissionError(null);
    setLiveVoiceState('CONNECTING');
    setLiveMessages([]);
    setLivePartialTranscript('');
    turnAudioAccumulatorRef.current = [];

    // Stop Mode A playback
    stopCurrentAudio();

    const token = getStoredToken();
    if (!token) {
      setError('Authentication token not found. Please log in again.');
      setLiveVoiceState('ERROR');
      return;
    }

    try {
      // 1. Initialize Web Audio 16kHz linear PCM microphone capture
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => { });
      }
      liveAudioContextRef.current = audioCtx;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      liveMediaStreamRef.current = stream;

      // 2. Establish WebSocket connection to backend Voice Gateway
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//localhost:8000/api/client/ai-calling/voice-stream?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      voiceWsRef.current = ws;

      ws.onopen = () => {
        // Authenticate & start session
        ws.send(JSON.stringify({ action: 'authenticate', token }));
        ws.send(
          JSON.stringify({
            action: 'start',
            language: selectedLanguage,
            speaker: selectedVoice,
          }),
        );
        // Start ping heartbeat every 15s to keep connection alive
        if (voicePingIntervalRef.current) clearInterval(voicePingIntervalRef.current);
        voicePingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleLiveGatewayEvent(msg);
        } catch (e: any) {
          console.error('Failed to parse gateway message:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('Voice WebSocket error:', e);
        setError('Voice streaming connection error.');
        setLiveVoiceState('ERROR');
      };

      ws.onclose = () => {
        if (voicePingIntervalRef.current) {
          clearInterval(voicePingIntervalRef.current);
          voicePingIntervalRef.current = null;
        }
        setLiveVoiceState('ENDED');
      };

      // 3. Connect microphone capture pipeline to WebSocket
      const source = audioCtx.createMediaStreamSource(stream);
      // ScriptProcessor processes 4096 samples at 16kHz (approx 256ms frames)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      liveProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMicMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcmBuffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Stream raw binary buffer over WebSocket
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(pcmBuffer.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermissionError(
          'Microphone access was denied. Please allow microphone permissions in your browser to start voice conversation.',
        );
      } else {
        setError(`Failed to initialize live voice streaming: ${err.message}`);
      }
      setLiveVoiceState('ERROR');
    }
  };

  const handleEndLiveVoice = () => {
    // 1. Clear heartbeat & close WebSocket
    if (voicePingIntervalRef.current) {
      clearInterval(voicePingIntervalRef.current);
      voicePingIntervalRef.current = null;
    }
    if (voiceWsRef.current) {
      try {
        if (voiceWsRef.current.readyState === WebSocket.OPEN) {
          voiceWsRef.current.send(JSON.stringify({ action: 'end' }));
        }
        voiceWsRef.current.close();
      } catch {
        // ignore
      }
      voiceWsRef.current = null;
    }

    // 2. Disconnect and stop microphone tracks
    if (liveMediaStreamRef.current) {
      liveMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      liveMediaStreamRef.current = null;
    }

    if (liveProcessorRef.current) {
      try {
        liveProcessorRef.current.disconnect();
      } catch {
        // ignore
      }
      liveProcessorRef.current = null;
    }

    if (liveAudioContextRef.current) {
      try {
        liveAudioContextRef.current.close();
      } catch {
        // ignore
      }
      liveAudioContextRef.current = null;
    }

    // 3. Stop any playing audio
    stopLiveAudioPlayback();
    setLiveVoiceState('IDLE');
    setLivePartialTranscript('');
  };

  const stopLiveAudioPlayback = () => {
    if (activePlaybackAudioRef.current) {
      try {
        activePlaybackAudioRef.current.pause();
        activePlaybackAudioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      activePlaybackAudioRef.current = null;
    }
    turnAudioAccumulatorRef.current = [];
  };

  // Play incoming synthesized full turn audio
  const playFullTurnAudio = (base64Wav: string, turnId: string) => {
    if (!base64Wav) return;

    // 1. Stop any current audio smoothly
    stopLiveAudioPlayback();

    // 2. Ensure live AudioContext is resumed
    if (liveAudioContextRef.current && liveAudioContextRef.current.state === 'suspended') {
      liveAudioContextRef.current.resume().catch(() => { });
    }

    try {
      const dataUri = `data:audio/wav;base64,${base64Wav}`;
      const audio = new Audio(dataUri);
      audio.volume = 1.0;
      activePlaybackAudioRef.current = audio;

      audio.onplay = () => {
        setLiveVoiceState('AI_SPEAKING');
      };

      audio.onended = () => {
        if (activePlaybackAudioRef.current === audio) {
          activePlaybackAudioRef.current = null;
        }
        setLiveVoiceState('LISTENING');
        if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
          voiceWsRef.current.send(
            JSON.stringify({ action: 'playback_finished', turnId }),
          );
        }
      };

      audio.onerror = (e) => {
        console.warn('Playback error on live audio:', e);
        if (activePlaybackAudioRef.current === audio) {
          activePlaybackAudioRef.current = null;
        }
        setLiveVoiceState('LISTENING');
        if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
          voiceWsRef.current.send(
            JSON.stringify({ action: 'playback_finished', turnId }),
          );
        }
      };

      audio.play().catch((err) => {
        console.warn('Live audio play error/prevented:', err);
        if (activePlaybackAudioRef.current === audio) {
          activePlaybackAudioRef.current = null;
        }
        setLiveVoiceState('LISTENING');
        if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
          voiceWsRef.current.send(
            JSON.stringify({ action: 'playback_finished', turnId }),
          );
        }
      });
    } catch (err: any) {
      console.error('Failed to instantiate audio element:', err);
      setLiveVoiceState('LISTENING');
    }
  };

  // Event handler for backend voice gateway messages
  const handleLiveGatewayEvent = (msg: any) => {
    switch (msg.type) {
      case 'state_change':
        setLiveVoiceState(msg.state);
        break;

      case 'session_ready':
        setLiveVoiceState('LISTENING');
        break;

      case 'user_speech_start':
        setLiveVoiceState('USER_SPEAKING');
        break;

      case 'partial_transcript':
        setLiveVoiceState('USER_SPEAKING');
        setLivePartialTranscript(msg.text);
        break;

      case 'final_transcript':
        setLivePartialTranscript('');
        if (msg.text) {
          setLiveMessages((prev) => [
            ...prev,
            {
              id: `user_${Date.now()}`,
              role: 'user',
              content: msg.text,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case 'audio_ready':
        // Complete assembled WAV audio frame ready for instant audible playback
        playFullTurnAudio(msg.audio, msg.turnId);
        break;

      case 'audio_chunk':
        // Progressive streaming chunk tracked by backend
        break;

      case 'tts_completion':
        // Turn generation complete
        break;

      case 'ai_turn_final':
        setLiveMessages((prev) => [
          ...prev,
          {
            id: `ai_${Date.now()}`,
            role: 'assistant',
            content: msg.text,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case 'interrupted':
        // Instant Barge-In: immediately halt playback!
        stopLiveAudioPlayback();
        setLiveVoiceState('INTERRUPTED');
        break;

      case 'language_switched':
        if (msg.language) {
          setSelectedLanguage(msg.language);
          if (msg.speaker) setSelectedVoice(msg.speaker);
        }
        break;

      case 'latency_metric':
        if (msg.metric === 'llm_first_token_ms') {
          setLiveMetrics((prev) => ({ ...prev, llmFirstTokenMs: msg.value }));
        } else if (msg.metric === 'tts_first_audio_ms') {
          setLiveMetrics((prev) => ({ ...prev, ttsFirstAudioMs: msg.value }));
        }
        break;

      case 'session_ended':
        handleEndLiveVoice();
        break;

      case 'error':
        setError(`Voice engine error: ${msg.error}`);
        break;
    }
  };

  const getStateBadge = (state: LiveVoiceState) => {
    switch (state) {
      case 'LISTENING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 animate-pulse">
            <Radio className="w-3.5 h-3.5 text-cyan-600 animate-spin" />
            Listening for your speech...
          </span>
        );
      case 'USER_SPEAKING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-xs animate-bounce">
            <Mic className="w-3.5 h-3.5 text-amber-600" />
            You are speaking...
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Bot className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            AI is thinking (Sarvam 105B)...
          </span>
        );
      case 'AI_SPEAKING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs">
            <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            AI is speaking (Barge-in ready)
          </span>
        );
      case 'INTERRUPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <Square className="w-3.5 h-3.5 text-rose-600" />
            Interrupted (playback stopped)
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
            Connecting to Voice Engine...
          </span>
        );
      case 'ENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            <PhoneOff className="w-3.5 h-3.5 text-slate-500" />
            Conversation Ended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
            Idle
          </span>
        );
    }
  };

  const getIntentBadge = (intent?: string) => {
    switch (intent) {
      case 'CALLBACK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Callback Requested
          </span>
        );
      case 'HUMAN_HANDOFF':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <UserCheck className="w-3 h-3 text-purple-600" />
            Human Agent Requested
          </span>
        );
      case 'OPT_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <PhoneOff className="w-3 h-3 text-rose-600" />
            Do-Not-Call (Opt-Out)
          </span>
        );
      case 'INTERESTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ThumbsUp className="w-3 h-3 text-emerald-600" />
            Interested
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
        <button
          type="button"
          onClick={() => {
            if (liveVoiceState !== 'IDLE' && liveVoiceState !== 'ENDED') {
              handleEndLiveVoice();
            }
            setActiveMode('LIVE_VOICE');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeMode === 'LIVE_VOICE'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
        >
          <Activity className="w-4 h-4 text-emerald-200 animate-pulse" />
          <span>Mode B: Live Voice Conversation</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-white/20 text-white font-semibold">
            Real-Time
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (liveVoiceState !== 'IDLE' && liveVoiceState !== 'ENDED') {
              handleEndLiveVoice();
            }
            setActiveMode('MANUAL');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeMode === 'MANUAL'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
        >
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <span>Mode A: Text & Manual Voice Test</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* MODE B: LIVE VOICE CONVERSATION INTERFACE                      */}
      {/* ============================================================== */}
      {activeMode === 'LIVE_VOICE' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col h-[670px] overflow-hidden">
          {/* Top Controls Bar */}
          <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Language Selector */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[11px] font-bold text-slate-600">Language:</span>
                <div className="flex items-center gap-1 ml-1">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setSelectedLanguage(lang.code);
                        const defaultVoice = BULBUL_VOICES[lang.code]?.[0]?.id || selectedVoice;
                        setSelectedVoice(defaultVoice);
                        if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
                          voiceWsRef.current.send(
                            JSON.stringify({
                              action: 'switch_language',
                              language: lang.code,
                              speaker: defaultVoice,
                            }),
                          );
                        }
                      }}
                      className={`px-2 py-0.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        selectedLanguage === lang.code
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {lang.native}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Persona Selector */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px] font-bold text-slate-600">Voice:</span>
                <select
                  value={selectedVoice}
                  onChange={(e) => {
                    const newVoice = e.target.value;
                    setSelectedVoice(newVoice);
                    if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
                      voiceWsRef.current.send(
                        JSON.stringify({
                          action: 'switch_language',
                          language: selectedLanguage,
                          speaker: newVoice,
                        }),
                      );
                    }
                  }}
                  className="text-xs font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
                >
                  {BULBUL_VOICES[selectedLanguage]?.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.description})
                    </option>
                  ))}
                </select>
              </div>

              {/* Real-time State Badge */}
              {getStateBadge(liveVoiceState)}
            </div>

            {/* Live Session Controls */}
            <div className="flex items-center gap-2">
              {liveVoiceState !== 'IDLE' && liveVoiceState !== 'ENDED' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsMicMuted(!isMicMuted)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${isMicMuted
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    {isMicMuted ? (
                      <>
                        <MicOff className="w-3.5 h-3.5 text-amber-600" />
                        <span>Muted</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mute Mic</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleEndLiveVoice}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>End Voice Conversation</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStartLiveVoice}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm shadow-emerald-600/20"
                >
                  <Activity className="w-4 h-4 text-emerald-200 animate-pulse" />
                  <span>Start Voice Conversation</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Voice Visualization & Live Transcripts Bar */}
          {liveVoiceState !== 'IDLE' && liveVoiceState !== 'ENDED' && (
            <div className="p-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-4 border-b border-indigo-900/50">
              <div className="flex items-center gap-3">
                {/* Animated Audio Soundwave */}
                <div className="flex items-center gap-1 h-6">
                  <span
                    className={`w-1 rounded-full bg-emerald-400 ${liveVoiceState === 'USER_SPEAKING' || liveVoiceState === 'AI_SPEAKING'
                        ? 'animate-pulse h-6'
                        : 'h-2 bg-slate-500'
                      }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-emerald-400 ${liveVoiceState === 'USER_SPEAKING' || liveVoiceState === 'AI_SPEAKING'
                        ? 'animate-bounce h-5'
                        : 'h-2 bg-slate-500'
                      }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-emerald-400 ${liveVoiceState === 'USER_SPEAKING' || liveVoiceState === 'AI_SPEAKING'
                        ? 'animate-pulse h-7'
                        : 'h-2 bg-slate-500'
                      }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-emerald-400 ${liveVoiceState === 'USER_SPEAKING' || liveVoiceState === 'AI_SPEAKING'
                        ? 'animate-bounce h-4'
                        : 'h-2 bg-slate-500'
                      }`}
                  />
                </div>

                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <span>Microphone Stream Active</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="text-xs text-white font-medium">
                    {livePartialTranscript ? (
                      <span className="italic text-emerald-300">
                        "{livePartialTranscript}..."
                      </span>
                    ) : liveVoiceState === 'AI_SPEAKING' ? (
                      <span className="text-indigo-200">
                        AI speaking... (Start speaking to interrupt)
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        Speak naturally — VAD is active...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Latency Metrics */}
              <div className="hidden sm:flex items-center gap-2 font-mono text-[10px]">
                {liveMetrics.llmFirstTokenMs && (
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-900/60 border border-indigo-700/50 text-indigo-200">
                    LLM: {liveMetrics.llmFirstTokenMs}ms
                  </span>
                )}
                {liveMetrics.ttsFirstAudioMs && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-900/60 border border-emerald-700/50 text-emerald-200">
                    TTS: {liveMetrics.ttsFirstAudioMs}ms
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
            {liveMessages.length === 0 && liveVoiceState === 'IDLE' ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-sm">
                  <Activity className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-slate-800 text-lg">
                    Real-Time Full-Duplex AI Voice Engine
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Click <strong>Start Voice Conversation</strong> once. Speak naturally into your
                    microphone without pressing record or send buttons. The AI greets you,
                    transcribes in real time, generates answers, and speaks aloud. You can interrupt
                    the AI at any moment.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleStartLiveVoice}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-md shadow-emerald-600/25"
                  >
                    <Activity className="w-4 h-4 text-emerald-200" />
                    <span>Start Voice Conversation</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {liveMessages.map((msg, index) => {
                  const isAssistant = msg.role === 'assistant';
                  return (
                    <div
                      key={msg.id || index}
                      className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'
                        }`}
                    >
                      {isAssistant && (
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1 ${isAssistant
                            ? 'bg-white text-slate-800 border border-slate-200/80 shadow-2xs'
                            : 'bg-emerald-600 text-white shadow-2xs'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px]">
                          <span
                            className={`font-bold ${isAssistant ? 'text-emerald-700' : 'text-emerald-100'
                              }`}
                          >
                            {isAssistant ? 'AI Spoken Voice (Sarvam)' : 'Customer (Live Voice)'}
                          </span>
                          <span className="opacity-70">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>

                      {!isAssistant && (
                        <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {livePartialTranscript && (
                  <div className="flex items-start gap-3 justify-end">
                    <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs animate-pulse">
                      <div className="text-[10px] font-bold text-emerald-700">
                        Transcribing in real-time (Saaras v4)...
                      </div>
                      <p className="text-xs italic leading-relaxed">
                        "{livePartialTranscript}"
                      </p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Mic className="w-4 h-4 animate-ping" />
                    </div>
                  </div>
                )}

                <div ref={liveMessagesEndRef} />
              </>
            )}
          </div>

          {/* Alerts in Mode B */}
          {error && (
            <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-rose-500 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {micPermissionError && (
            <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{micPermissionError}</span>
              </div>
              <button
                onClick={() => setMicPermissionError(null)}
                className="text-amber-700 hover:text-amber-950 text-[11px] font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE A: TEXT / MANUAL VOICE TEST (PHASES 1–4 PRESERVED)         */}
      {/* ============================================================== */}
      {activeMode === 'MANUAL' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col h-[670px] overflow-hidden">
          {/* Playground Top Controls Bar */}
          <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Language Selector */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[11px] font-bold text-slate-600">Language:</span>
                <div className="flex items-center gap-1 ml-1">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.code}
                      disabled={starting || loading || isRecording || isTranscribing}
                      onClick={async () => {
                        setSelectedLanguage(lang.code);
                        stopCurrentAudio();
                        if (session) {
                          try {
                            const res = await apiFetch<PlaygroundSession>(
                              `/client/ai-calling/conversations/${session.id}/language`,
                              {
                                method: 'POST',
                                body: JSON.stringify({ language: lang.code }),
                              },
                            );
                            setSession(res);
                          } catch {
                            handleStartConversation(lang.code);
                          }
                        }
                      }}
                      className={`px-2 py-0.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        selectedLanguage === lang.code
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {lang.native}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulbul v4 Voice Selector */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px] font-bold text-slate-600">Voice:</span>
                <select
                  value={selectedVoice}
                  onChange={(e) => {
                    setSelectedVoice(e.target.value);
                    audioCacheRef.current = {};
                  }}
                  disabled={starting || loading || isRecording || isTranscribing}
                  className="text-xs font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
                >
                  {BULBUL_VOICES[selectedLanguage]?.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.description})
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-Play Toggle */}
              <button
                type="button"
                onClick={() => setAutoPlayTts(!autoPlayTts)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${autoPlayTts
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                title="Automatically synthesize and play AI response speech when generated"
              >
                {autoPlayTts ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Auto-Play: ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    <span>Auto-Play: OFF</span>
                  </>
                )}
              </button>

              {/* Latency Indicators */}
              {session?.lastLatencyMs !== undefined && (
                <div
                  className="hidden sm:flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-mono"
                  title="Last LLM Response Latency"
                >
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>LLM: {session.lastLatencyMs}ms</span>
                </div>
              )}

              {sttMetadata?.latencyMs !== undefined && (
                <div
                  className="hidden md:flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-indigo-200 text-[11px] text-indigo-700 font-mono"
                  title="Last STT Transcription Latency"
                >
                  <Radio className="w-3 h-3 text-indigo-500" />
                  <span>STT: {sttMetadata.latencyMs}ms</span>
                </div>
              )}

              {session && getIntentBadge(session.detectedIntent)}
            </div>

            <div className="flex items-center gap-2">
              {session ? (
                <button
                  onClick={handleReset}
                  disabled={loading || isTranscribing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
                  title="Reset this conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset</span>
                </button>
              ) : (
                <button
                  onClick={() => handleStartConversation(selectedLanguage)}
                  disabled={starting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{starting ? 'Connecting...' : 'Start New Conversation'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Chat Thread Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/30">
            {!session ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 py-12">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <Bot className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-slate-800 text-base">
                    Sarvam STT + LLM + TTS Playground
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Speak into your microphone with <strong>Saaras v4</strong>, chat multi-turn with{' '}
                    <strong>Sarvam 105B</strong>, and listen to humanized voice responses generated by{' '}
                    <strong>Bulbul v4 Flash</strong>.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleStartConversation(selectedLanguage)}
                    disabled={starting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{starting ? 'Starting Simulation...' : 'Start New Conversation'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {session.messages.map((msg, index) => {
                  const isAssistant = msg.role === 'assistant';
                  const isSynthesizing = synthesizingMessageId === msg.id;
                  const isPlaying = playingMessageId === msg.id;
                  const ttsLatency = ttsLatencyMap[msg.id];

                  return (
                    <div
                      key={msg.id || index}
                      className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'
                        }`}
                    >
                      {isAssistant && (
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1 ${isAssistant
                            ? 'bg-white text-slate-800 border border-slate-200/80 shadow-2xs'
                            : 'bg-indigo-600 text-white shadow-2xs'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px]">
                          <span
                            className={`font-bold ${isAssistant ? 'text-indigo-600' : 'text-indigo-200'
                              }`}
                          >
                            {isAssistant ? 'AI Assistant (Sarvam)' : 'Customer'}
                          </span>
                          <div className="flex items-center gap-1.5 opacity-70">
                            {msg.durationMs && isAssistant && (
                              <span className="font-mono text-[9px]">
                                {msg.durationMs}ms
                              </span>
                            )}
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>

                        {/* Bulbul Text-to-Speech Playback Controls */}
                        {isAssistant && (
                          <div className="pt-2 mt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handlePlayMessage(msg)}
                              disabled={isSynthesizing}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs ${isPlaying
                                  ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse'
                                  : isSynthesizing
                                    ? 'bg-slate-100 text-slate-500 cursor-wait'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                }`}
                              title={
                                isPlaying
                                  ? 'Stop audio playback'
                                  : 'Play aloud with Sarvam Bulbul v4 Flash'
                              }
                            >
                              {isSynthesizing ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                                  <span className="text-[10px]">Generating Voice...</span>
                                </>
                              ) : isPlaying ? (
                                <>
                                  <Square className="w-3 h-3 fill-white" />
                                  <span className="text-[10px]">Stop Audio</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3 h-3 text-emerald-600" />
                                  <span className="text-[10px]">Play Voice</span>
                                </>
                              )}
                            </button>

                            <div className="flex items-center gap-1.5">
                              {ttsLatency && (
                                <span className="text-[9px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  TTS: {ttsLatency}ms
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400 font-mono">
                                bulbul:v4-flash
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {!isAssistant && (
                        <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {isTranscribing && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Radio className="w-4 h-4 animate-spin text-indigo-600" />
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-2.5 text-xs text-indigo-900 flex items-center gap-2 shadow-2xs">
                      <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                      <span className="text-[11px] font-semibold">
                        Transcribing speech with Sarvam Saaras (saaras:v4)...
                      </span>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-500 flex items-center gap-2 shadow-2xs">
                      <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
                      <div
                        className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"
                        style={{ animationDelay: '0.15s' }}
                      />
                      <div
                        className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"
                        style={{ animationDelay: '0.3s' }}
                      />
                      <span className="text-[11px] font-medium ml-1">
                        Sarvam AI is generating response...
                      </span>
                    </div>
                  </div>
                )}

                {session.status === 'ENDED' && (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-center text-xs text-slate-600 space-y-1">
                    <div className="font-bold flex items-center justify-center gap-1.5 text-slate-700">
                      <PhoneOff className="w-3.5 h-3.5 text-slate-500" />
                      Conversation Ended
                    </div>
                    <p className="text-[11px] text-slate-500">
                      The customer opted out or session was ended. Click "Reset" or "Start New Conversation" to test again.
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Suggested Quick Prompts */}
          {session && session.status === 'ACTIVE' && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200/60 overflow-x-auto flex items-center gap-1.5 scrollbar-thin">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-slate-400" />
                Quick Prompts:
              </span>
              {SUGGESTED_PROMPTS[selectedLanguage]?.map((item, idx) => (
                <button
                  key={idx}
                  disabled={loading || isRecording || isTranscribing}
                  onClick={() => handleSendMessage(item.text)}
                  className="shrink-0 px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Microphone Permission Error Alert */}
          {micPermissionError && (
            <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{micPermissionError}</span>
              </div>
              <button
                onClick={() => setMicPermissionError(null)}
                className="text-amber-700 hover:text-amber-950 text-[11px] font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Error Alert Display */}
          {error && (
            <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-rose-500 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Recognized STT Confirmation Notification */}
          {sttMetadata && (
            <div className="px-4 py-1.5 bg-emerald-50 border-t border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Transcribed via <strong>Sarvam Saaras</strong> ({sttMetadata.languageCode || 'auto'}) in{' '}
                  {sttMetadata.latencyMs}ms. Please review or edit below before sending.
                </span>
              </div>
              <button
                onClick={() => setSttMetadata(null)}
                className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Hidden Audio File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelected}
            accept="audio/wav,audio/webm,audio/mp3,audio/m4a,audio/ogg,audio/flac,.wav,.webm,.mp3,.m4a,.ogg,.flac"
            className="hidden"
          />

          {/* Message Input Bar & Audio Controls */}
          <div className="p-3 sm:p-4 border-t border-slate-200/80 bg-white">
            {isRecording ? (
              <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                  <span className="text-xs font-bold text-rose-700">
                    Recording microphone audio... ({recordingSeconds}s / 30s max)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Done & Transcribe</span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={handleStartRecording}
                  disabled={!session || session.status === 'ENDED' || loading || isTranscribing}
                  title="Speak via Microphone (Sarvam Saaras STT)"
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 text-slate-600 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-2xs"
                >
                  <Mic className="w-4 h-4 text-indigo-600" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!session || session.status === 'ENDED' || loading || isTranscribing}
                  title="Upload audio file (.wav, .mp3, .webm, .m4a)"
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 text-slate-600 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-2xs"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                </button>

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    !session
                      ? 'Start a conversation first to begin chatting or speaking...'
                      : session.status === 'ENDED'
                        ? 'Conversation ended. Click Reset to start again.'
                        : isTranscribing
                          ? 'Transcribing audio with Sarvam Saaras...'
                          : selectedLanguage === 'hi'
                            ? 'माइक से बोलें या ग्राहक का संदेश लिखें...'
                            : selectedLanguage === 'te'
                              ? 'మైక్‌లో మాట్లాడండి లేదా కస్టమర్ సందేశాన్ని టైప్ చేయండి...'
                              : selectedLanguage === 'kn'
                                ? 'ಮೈಕ್ ಮೂಲಕ ಮಾತನಾಡಿ ಅಥವಾ ಗ್ರಾಹಕರ ಸಂದೇಶವನ್ನು ಟೈಪ್ ಮಾಡಿ...'
                                : 'Speak via mic, upload audio, or type customer message...'
                  }
                  disabled={!session || session.status === 'ENDED' || loading || isTranscribing}
                  className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition disabled:opacity-50 disabled:bg-slate-100"
                />

                <button
                  type="submit"
                  disabled={
                    !session ||
                    session.status === 'ENDED' ||
                    !inputMessage.trim() ||
                    loading ||
                    isTranscribing
                  }
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
