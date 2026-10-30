import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SarvamLlmService } from './sarvam-llm.service.js';
import { randomUUID } from 'crypto';

export type SupportedLanguage = 'en' | 'hi' | 'te' | 'kn';

export type DetectedIntent =
  | 'GENERAL'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'CALLBACK'
  | 'HUMAN_HANDOFF'
  | 'OPT_OUT';

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
  detectedIntent: DetectedIntent;
  lastLatencyMs?: number;
  messages: PlaygroundMessage[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SarvamConversationService {
  private readonly logger = new Logger(SarvamConversationService.name);

  // In-memory conversation session registry keyed by conversationId
  private readonly sessions = new Map<string, PlaygroundSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sarvamLlmService: SarvamLlmService,
  ) {
    // Run periodic cleanup for expired sessions (> 4 hours) every 30 minutes
    setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000).unref();
  }

  /**
   * Starts a new multi-turn simulated AI calling conversation playground session.
   * Enforces tenant context and prepares the system prompt.
   */
  async startConversation(
    clientId: string,
    language: SupportedLanguage = 'en',
  ): Promise<PlaygroundSession> {
    if (!['en', 'hi', 'te', 'kn'].includes(language)) {
      throw new BadRequestException(
        `Unsupported language: ${language}. Allowed languages are 'en', 'hi', 'te', and 'kn'.`,
      );
    }

    // Fetch tenant company name from Prisma
    let companyName = 'Our Company';
    try {
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true, businessCategory: true },
      });
      if (client?.name) {
        companyName = client.name;
      }
    } catch (err: any) {
      this.logger.warn(`Could not fetch client name for ${clientId}: ${err.message}`);
    }

    const sessionId = `sim_conv_${randomUUID()}`;
    const now = new Date().toISOString();

    const systemPrompt = this.buildSystemPrompt(companyName, language);

    // Initial greeting triggered from LLM or generated contextually
    const session: PlaygroundSession = {
      id: sessionId,
      clientId,
      companyName,
      language,
      status: 'ACTIVE',
      detectedIntent: 'GENERAL',
      messages: [
        {
          id: `msg_${randomUUID()}`,
          role: 'system',
          content: systemPrompt,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // Generate initial AI introductory greeting turn via real Sarvam LLM
    try {
      const greetingPrompt =
        language === 'hi'
          ? 'कृपया अपना और कंपनी का परिचय दें और ग्राहक का स्वागत करें।'
          : language === 'te'
          ? 'దయచేసి మిమ్మల్ని మరియు కంపెనీని పరిచయం చేసి కಸ್ಟಮర్‌ను స్వాగతించండి.'
          : language === 'kn'
          ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮನ್ನು ಮತ್ತು ಕಂಪನಿಯನ್ನು ಪರಿಚಯಿಸಿ ಮತ್ತು ಗ್ರಾಹಕರನ್ನು ಸ್ವಾಗತಿಸಿ.'
          : 'Please introduce yourself and the company politely, and ask how you can help today.';

      const llmResult = await this.sarvamLlmService.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: greetingPrompt },
      ]);

      session.messages.push({
        id: `msg_${randomUUID()}`,
        role: 'assistant',
        content: llmResult.content.trim(),
        timestamp: new Date().toISOString(),
        durationMs: llmResult.durationMs,
      });
      session.lastLatencyMs = llmResult.durationMs;
    } catch (err: any) {
      this.logger.error(`Error generating initial greeting: ${err.message}`);
      // Fallback greeting if network latency spike occurs on initial connection
      const fallbackGreeting =
        language === 'hi'
          ? `नमस्ते! मैं ${companyName} से आपका एआई कॉलिंग असिस्टेंट हूँ। आज मैं आपकी कैसे सहायता कर सकता हूँ?`
          : language === 'te'
          ? `నమస్కారం! నేను ${companyName} నుండి మీ AI కాలింగ్ అసిస్టెంట్‌ని. ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?`
          : language === 'kn'
          ? `ನಮಸ್ಕಾರ! ನಾನು ${companyName} ಇಂದ ನಿಮ್ಮ AI ಕಾಲಿಂಗ್ ಅಸಿಸ್ಟೆಂಟ್. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`
          : `Hello! I am your AI calling assistant from ${companyName}. How can I assist you today?`;

      session.messages.push({
        id: `msg_${randomUUID()}`,
        role: 'assistant',
        content: fallbackGreeting,
        timestamp: new Date().toISOString(),
      });
    }

    this.sessions.set(sessionId, session);
    return this.sanitizeSession(session);
  }

  /**
   * Switches language during an active conversation session while preserving all previous multi-turn memory
   */
  async switchLanguage(
    conversationId: string,
    clientId: string,
    newLanguage: SupportedLanguage,
  ): Promise<PlaygroundSession> {
    if (!['en', 'hi', 'te', 'kn'].includes(newLanguage)) {
      throw new BadRequestException(`Unsupported language: ${newLanguage}`);
    }

    const session = this.getValidatedSession(conversationId, clientId);
    session.language = newLanguage;
    session.updatedAt = new Date().toISOString();

    const langName =
      newLanguage === 'hi'
        ? 'Hindi'
        : newLanguage === 'te'
        ? 'Telugu'
        : newLanguage === 'kn'
        ? 'Kannada'
        : 'English';

    // Append instruction for the LLM to seamlessly transition language
    session.messages.push({
      id: `msg_${randomUUID()}`,
      role: 'system',
      content: `[Language Switched to ${langName}]: The customer switched the language to ${langName}. From now on, strictly respond in natural, polite ${langName} (using the native script) while retaining and building upon all previous conversation context.`,
      timestamp: new Date().toISOString(),
    });

    return this.sanitizeSession(session);
  }

  /**
   * Sends a customer message, executes business rule analysis, and calls real Sarvam LLM.
   */
  async sendMessage(
    conversationId: string,
    clientId: string,
    customerText: string,
  ): Promise<{
    session: PlaygroundSession;
    aiResponse: string;
    detectedIntent: DetectedIntent;
    latencyMs: number;
  }> {
    const session = this.getValidatedSession(conversationId, clientId);

    if (session.status === 'ENDED') {
      throw new BadRequestException(
        'This conversation session has already ended. Please start a new conversation.',
      );
    }

    const trimmed = (customerText || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Customer message cannot be empty.');
    }
    if (trimmed.length > 500) {
      throw new BadRequestException('Customer message exceeds maximum length of 500 characters.');
    }

    // 1. Detect customer business intent with backend-controlled rules
    const detectedIntent = this.evaluateIntent(trimmed);
    session.detectedIntent = detectedIntent;

    // 2. Append customer message turn
    const userMsgId = `msg_${randomUUID()}`;
    const userTurn: PlaygroundMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userTurn);

    // 3. Assemble message history for Sarvam Chat Completion
    const llmMessages = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 4. Send multi-turn context to Sarvam official LLM
    const startTime = Date.now();
    const llmResult = await this.sarvamLlmService.chatCompletion(llmMessages, {
      model: 'sarvam-105b-conversations',
      temperature: 0.2,
      maxTokens: 512,
    });
    const latencyMs = llmResult.durationMs || Date.now() - startTime;

    // 5. Append AI assistant message turn
    const assistantMsgId = `msg_${randomUUID()}`;
    const aiContent = llmResult.content.trim();
    const assistantTurn: PlaygroundMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: aiContent,
      timestamp: new Date().toISOString(),
      durationMs: latencyMs,
    };
    session.messages.push(assistantTurn);
    session.lastLatencyMs = latencyMs;
    session.updatedAt = new Date().toISOString();

    // If customer explicitly opts out, end session
    if (detectedIntent === 'OPT_OUT') {
      session.status = 'ENDED';
    }

    return {
      session: this.sanitizeSession(session),
      aiResponse: aiContent,
      detectedIntent,
      latencyMs,
    };
  }

  /**
   * Retrieves conversation session history for the authenticated tenant
   */
  async getConversation(
    conversationId: string,
    clientId: string,
  ): Promise<PlaygroundSession> {
    const session = this.getValidatedSession(conversationId, clientId);
    return this.sanitizeSession(session);
  }

  /**
   * Resets / ends an active conversation session
   */
  async endConversation(
    conversationId: string,
    clientId: string,
  ): Promise<{ success: boolean; message: string }> {
    const session = this.getValidatedSession(conversationId, clientId);
    session.status = 'ENDED';
    this.sessions.delete(conversationId);
    return {
      success: true,
      message: 'Conversation reset successfully',
    };
  }

  /**
   * Tenant isolation validator
   */
  private getValidatedSession(conversationId: string, clientId: string): PlaygroundSession {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new NotFoundException(`Conversation session "${conversationId}" not found`);
    }

    if (session.clientId !== clientId) {
      throw new ForbiddenException('Cross-tenant access forbidden: conversation belongs to another tenant');
    }

    return session;
  }

  /**
   * Strip system prompt from client-facing output for clean UI display
   */
  private sanitizeSession(session: PlaygroundSession): PlaygroundSession {
    return {
      ...session,
      messages: session.messages.filter((m) => m.role !== 'system'),
    };
  }

  /**
   * Build humanized AI caller system prompt with multi-turn constraints
   */
  private buildSystemPrompt(companyName: string, language: SupportedLanguage): string {
    const languageDirective = {
      en: 'Converse in clear, natural English.',
      hi: 'Converse in natural, polite Hindi using Devanagari script (e.g. "नमस्ते, मैं आपकी सहायता कैसे कर सकता हूँ?").',
      te: 'Converse in natural, polite Telugu using Telugu script (e.g. "నమస్కారం, నేను మీకు ఎలా సహాయపడగలను?").',
      kn: 'Converse in natural, polite Kannada using Kannada script (e.g. "ನಮಸ್ಕಾರ, ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?").',
    }[language];

    return `You are a professional, humanized AI calling representative representing "${companyName}".
${languageDirective}

MANDATORY RULES:
1. Role: You are an AI assistant. Always be polite, respectful, and helpful.
2. Voice-ready conciseness: Keep responses short (1 to 2 sentences max). Never output long essays, lists, or markdown bullet points.
3. One question at a time: Ask only one focused question at a time to keep the conversation conversational.
4. Language strictness: Always reply in the requested language (${language.toUpperCase()}). Do not switch languages unless asked.
5. Multi-turn memory: Accurately remember and build upon details provided by the user in earlier turns of this conversation.
6. Guardrails & Zero Fabrication:
   - NEVER invent company pricing, discounts, guarantees, or secret features.
   - If asked about exact pricing or unavailable details, clearly say: "I do not have the exact pricing details right now, but I can arrange for a senior advisor to share the full details with you."
7. Outcome recognition:
   - If customer asks to call back: Acknowledge politely and ask for their preferred time.
   - If customer asks to speak to a real human: Reassure them that a team member will follow up promptly.
   - If customer asks not to be called / opt-out: Apologize politely and confirm their number is marked not to be contacted again.`;
  }

  /**
   * Deterministic backend-controlled business rules for high-value intent classification
   */
  evaluateIntent(text: string): DetectedIntent {
    const lower = text.toLowerCase();

    // Opt-out / Do Not Call patterns (English, Hindi, Telugu, Kannada)
    if (
      lower.includes('do not call') ||
      lower.includes("don't call") ||
      lower.includes('stop calling') ||
      lower.includes('remove my number') ||
      lower.includes('unsubscribe') ||
      lower.includes('कॉल मत करो') ||
      lower.includes('फोन मत करो') ||
      lower.includes('बंद करो') ||
      lower.includes('ನಾಕು కాల్ చేయవద్దు') ||
      lower.includes('ఆపండి') ||
      lower.includes('ಕರೆ ಮಾಡಬೇಡಿ') ||
      lower.includes('ಫೋನ್ ಮಾಡಬೇಡಿ') ||
      lower.includes('ನಿಲ್ಲಿಸಿ') ||
      lower.includes('ತೆಗೆದುಹಾಕಿ')
    ) {
      return 'OPT_OUT';
    }

    // Human handoff requests
    if (
      lower.includes('human') ||
      lower.includes('real person') ||
      lower.includes('agent') ||
      lower.includes('executive') ||
      lower.includes('manager') ||
      lower.includes('insan se') ||
      lower.includes('kisi se baat') ||
      lower.includes('మనిషి') ||
      lower.includes('మాట్లాడాలి') ||
      lower.includes('ಮಾನವ') ||
      lower.includes('ಅಧಿಕಾರಿ') ||
      lower.includes('ವ್ಯಕ್ತಿಯೊಂದಿಗೆ') ||
      lower.includes('ಏಜೆಂಟ್') ||
      lower.includes('ಮಾತನಾಡಬೇಕು')
    ) {
      return 'HUMAN_HANDOFF';
    }

    // Callback requests
    if (
      lower.includes('call back') ||
      lower.includes('call me later') ||
      lower.includes('call me tomorrow') ||
      lower.includes('busy right now') ||
      lower.includes('busy now') ||
      lower.includes('baad me call') ||
      lower.includes('kal call') ||
      lower.includes('తర్వాత కాల్') ||
      lower.includes('ಮತ್ತೆ ಕರೆ ಮಾಡಿ') ||
      lower.includes('ನಂತರ ಕರೆ ಮಾಡಿ') ||
      lower.includes('ನಾಳೆ ಕರೆ ಮಾಡಿ') ||
      lower.includes('ಕರೆ ಮಾಡಬಹುದೇ') ||
      lower.includes('ಈಗ ಬಿಡುವಿಲ್ಲ') ||
      lower.includes('ಬಿಡುವಿಲ್ಲ') ||
      lower.includes('ಬ್ಯುಸಿ')
    ) {
      return 'CALLBACK';
    }

    // Negative sentiment / Not interested
    if (
      lower.includes('not interested') ||
      lower.includes('no thanks') ||
      lower.includes('no need') ||
      lower.includes('nahi chahiye') ||
      lower.includes('ruchi nahi') ||
      lower.includes('వద్దు') ||
      lower.includes('ఆసక్తి లేదు') ||
      lower.includes('ಆಸಕ್ತಿ ಇಲ್ಲ') ||
      lower.includes('ಬೇಡ') ||
      lower.includes('ಅಗತ್ಯವಿಲ್ಲ')
    ) {
      return 'NOT_INTERESTED';
    }

    // Positive interest
    if (
      lower.includes('interested') ||
      lower.includes('tell me more') ||
      lower.includes('want to know') ||
      lower.includes('yes') ||
      lower.includes('haan') ||
      lower.includes('sahi hai') ||
      lower.includes('వివరాలు') ||
      lower.includes('చెప్పండి') ||
      lower.includes('ಆಸಕ್ತಿ ಇದೆ') ||
      lower.includes('ವಿವರ ತಿಳಿಸಿ') ||
      lower.includes('ಮಾಹಿತಿ') ||
      lower.includes('ಹೌದು')
    ) {
      return 'INTERESTED';
    }

    return 'GENERAL';
  }

  /**
   * Cleanup sessions older than 4 hours
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    for (const [id, session] of this.sessions.entries()) {
      const sessionAge = now - new Date(session.updatedAt).getTime();
      if (sessionAge > fourHoursMs) {
        this.sessions.delete(id);
      }
    }
  }
}
