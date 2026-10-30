import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { VoiceConversationOrchestratorService } from './voice-conversation-orchestrator.service.js';
import { SupportedLanguage } from './sarvam-conversation.service.js';

interface AuthenticatedClient {
  userId: string;
  clientId: string;
  email: string;
  role: string;
}

@Injectable()
export class VoiceConversationGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VoiceConversationGateway.name);
  private wss: WebSocketServer | null = null;
  private readonly activeSessions = new Map<WebSocket, any>();
  private readonly jwtSecret =
    process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly orchestrator: VoiceConversationOrchestratorService,
  ) {}

  onModuleInit() {
    const httpServer = this.httpAdapterHost?.httpAdapter?.getHttpServer();
    if (!httpServer) {
      this.logger.warn('HttpServer not available during VoiceConversationGateway initialization.');
      return;
    }

    const path = '/api/client/ai-calling/voice-stream';
    this.wss = new WebSocketServer({
      server: httpServer,
      path,
      maxPayload: 10 * 1024 * 1024, // 10MB guard
    });

    this.logger.log(`VoiceConversationGateway WebSocket server mounted on ${path}`);

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });
  }

  onModuleDestroy() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  /**
   * Handle incoming WebSocket client connection with authentication
   */
  private handleConnection(ws: WebSocket, req: any) {
    this.logger.log(`New voice WebSocket client connection from ${req.socket.remoteAddress}`);

    let authenticatedClient: AuthenticatedClient | null = null;

    // Check query token or Sec-WebSocket-Protocol token
    const url = new URL(req.url || '', 'http://localhost:8000');
    const queryToken = url.searchParams.get('token');
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const protocolToken = req.headers['sec-websocket-protocol'];

    const token = bearerToken || queryToken || protocolToken;

    if (token) {
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        authenticatedClient = {
          userId: decoded.sub || decoded.id,
          clientId: decoded.clientId,
          email: decoded.email,
          role: decoded.role,
        };
      } catch (err: any) {
        this.logger.warn(`Initial token validation failed: ${err.message}`);
      }
    }

    ws.on('message', async (data: WebSocket.RawData, isBinary: boolean) => {
      try {
        // If binary: incoming raw PCM audio chunk from browser microphone
        if (isBinary) {
          const session = this.activeSessions.get(ws);
          if (session) {
            session.receivePcmAudio(Buffer.isBuffer(data) ? data : Buffer.from(data as any));
          }
          return;
        }

        // If text: JSON control message
        const text = data.toString('utf-8');
        const msg = JSON.parse(text);

        // Explicit authentication message if token wasn't in handshake
        if (msg.action === 'authenticate') {
          try {
            const decoded = jwt.verify(msg.token, this.jwtSecret) as any;
            authenticatedClient = {
              userId: decoded.sub || decoded.id,
              clientId: decoded.clientId,
              email: decoded.email,
              role: decoded.role,
            };
            ws.send(JSON.stringify({ type: 'authenticated', client: authenticatedClient }));
          } catch (err: any) {
            ws.send(JSON.stringify({ type: 'error', error: `Auth failed: ${err.message}` }));
            ws.close(4001, 'Unauthorized');
          }
          return;
        }

        // Enforce authentication before starting voice session
        if (!authenticatedClient) {
          ws.send(JSON.stringify({ type: 'error', error: 'Authentication required. Please authenticate.' }));
          return;
        }

        switch (msg.action) {
          case 'start': {
            // Terminate existing session if active
            const existing = this.activeSessions.get(ws);
            if (existing) {
              existing.endSession();
            }

            const language: SupportedLanguage = msg.language || 'en';
            const speaker = msg.speaker;

            const session = await this.orchestrator.startVoiceSession({
              clientId: authenticatedClient.clientId,
              language,
              speaker,
              onClientEmit: (event) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(event));
                }
              },
            });

            this.activeSessions.set(ws, session);
            ws.send(
              JSON.stringify({
                type: 'session_ready',
                sessionId: session.sessionId,
                language,
                speaker,
              }),
            );
            break;
          }

          case 'audio_pcm': {
            // In case audio is sent as base64 in JSON
            const session = this.activeSessions.get(ws);
            if (session && msg.audio) {
              session.receivePcmAudio(Buffer.from(msg.audio, 'base64'));
            }
            break;
          }

          case 'playback_finished': {
            const session = this.activeSessions.get(ws);
            if (session && msg.turnId) {
              session.notifyPlaybackFinished(msg.turnId);
            }
            break;
          }

          case 'interrupt': {
            const session = this.activeSessions.get(ws);
            if (session) {
              session.interrupt();
            }
            break;
          }

          case 'end': {
            const session = this.activeSessions.get(ws);
            if (session) {
              session.endSession();
              this.activeSessions.delete(ws);
            }
            break;
          }

          case 'switch_language': {
            const session = this.activeSessions.get(ws);
            if (session && msg.language) {
              session.switchLanguage(msg.language, msg.speaker);
            }
            break;
          }

          case 'ping': {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
            break;
          }

          default:
            this.logger.debug(`Unknown action: ${msg.action}`);
            break;
        }
      } catch (err: any) {
        this.logger.error(`Error handling voice WS message: ${err.message}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', error: err.message }));
        }
      }
    });

    ws.on('close', (code, reason) => {
      this.logger.log(`Voice client disconnected (code: ${code}, reason: ${reason})`);
      const session = this.activeSessions.get(ws);
      if (session) {
        session.endSession();
        this.activeSessions.delete(ws);
      }
    });

    ws.on('error', (err) => {
      this.logger.error(`Voice client socket error: ${err.message}`);
    });
  }
}
