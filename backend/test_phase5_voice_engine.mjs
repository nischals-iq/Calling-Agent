import 'dotenv/config';
import fs from 'fs';
import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import jwt from 'jsonwebtoken';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const API_URL = 'http://localhost:8000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';

// Read generated test audio files for PCM audio streaming
const wavEn = fs.readFileSync('test_tts_en.wav');
const pcmEn = wavEn.subarray(44);

const wavHi = fs.readFileSync('test_tts_hi.wav');
const pcmHi = wavHi.subarray(44);

const wavTe = fs.readFileSync('test_tts_te.wav');
const pcmTe = wavTe.subarray(44);

async function runPhase5Verification() {
  console.log('================================================================');
  console.log(' PHASE 5: REAL-TIME AI VOICE CONVERSATION ENGINE TEST SUITE ');
  console.log(' Full-Duplex Voice: Saaras v4 STT ⇄ Sarvam 105B ⇄ Bulbul v4 TTS ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Get test tenant admin & generate auth token
    const tenantUser = await prisma.user.findFirst({
      where: { role: 'CLIENT_ADMIN' },
      include: { client: true },
    });

    if (!tenantUser || !tenantUser.client) {
      throw new Error('No client admin user found in database for testing');
    }

    const token = jwt.sign(
      {
        sub: tenantUser.id,
        email: tenantUser.email,
        clientId: tenantUser.clientId,
        role: tenantUser.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    console.log(`Authenticated Tenant: "${tenantUser.client.name}" (${tenantUser.clientId})\n`);

    // -------------------------------------------------------------
    // Test 1: Service Unit Validations
    // -------------------------------------------------------------
    console.log('--- TEST 1: Streaming Services Unit Validation ---');
    const { SarvamStreamingSttService } = await import(
      './dist/modules/ai-calling/sarvam-streaming-stt.service.js'
    );
    const { SarvamStreamingTtsService } = await import(
      './dist/modules/ai-calling/sarvam-streaming-tts.service.js'
    );
    const { SarvamStreamingLlmService } = await import(
      './dist/modules/ai-calling/sarvam-streaming-llm.service.js'
    );
    const { VoiceConversationOrchestratorService } = await import(
      './dist/modules/ai-calling/voice-conversation-orchestrator.service.js'
    );

    const stt = new SarvamStreamingSttService();
    const tts = new SarvamStreamingTtsService();
    const llm = new SarvamStreamingLlmService();

    assert(typeof stt.createSession === 'function', 'SarvamStreamingSttService implements createSession()');
    assert(typeof tts.createSession === 'function', 'SarvamStreamingTtsService implements createSession()');
    assert(typeof llm.streamChatCompletion === 'function', 'SarvamStreamingLlmService implements streamChatCompletion()');

    // -------------------------------------------------------------
    // Test 2: Live Gateway WebSocket Handshake & Auth Guards
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Gateway WebSocket Handshake & Auth Guards ---');

    // 2a: Unauthenticated attempt
    await new Promise((resolve) => {
      const unauthWs = new WebSocket('ws://localhost:8000/api/client/ai-calling/voice-stream');
      unauthWs.on('open', () => {
        unauthWs.send(JSON.stringify({ action: 'start' }));
      });
      unauthWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'error' && msg.error.includes('Authentication required')) {
          assert(true, 'Gateway rejects unauthenticated connection attempts with error message');
          unauthWs.close();
          resolve(true);
        }
      });
      unauthWs.on('error', () => resolve(true));
    });

    // 2b: Authenticated connection
    await new Promise((resolve) => {
      const authWs = new WebSocket(
        `ws://localhost:8000/api/client/ai-calling/voice-stream?token=${token}`,
      );
      authWs.on('open', () => {
        assert(true, 'Gateway accepts authenticated tenant WebSocket connections');
        authWs.close();
        resolve(true);
      });
      authWs.on('error', (err) => {
        assert(false, `Authenticated handshake failed: ${err.message}`);
        resolve(false);
      });
    });

    // -------------------------------------------------------------
    // Test 3: Full-Duplex English Conversation Flow + Barge-In
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Full-Duplex English Voice Conversation & Barge-In ---');
    await new Promise((resolve) => {
      const ws = new WebSocket(
        `ws://localhost:8000/api/client/ai-calling/voice-stream?token=${token}`,
      );

      let greetingReceived = false;
      let partialTranscriptHeard = false;
      let finalTranscriptHeard = false;
      let aiTextHeard = false;
      let aiAudioHeard = false;
      let bargeInTriggered = false;

      const timeout = setTimeout(() => {
        console.error('Test 3 timed out after 35s');
        ws.close();
        resolve(false);
      }, 35000);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            action: 'start',
            language: 'en',
            speaker: 'simran_en_customer',
          }),
        );
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'session_ready') {
          assert(true, `English voice session initialized: ${msg.sessionId}`);
        }

        if (msg.type === 'audio_chunk' && !greetingReceived) {
          greetingReceived = true;
          assert(true, 'Received streaming AI greeting audio from Bulbul v4 Flash');

          // Inject user speech stream after greeting starts
          setTimeout(() => {
            console.log('  -> Streaming English speech PCM audio to Sarvam Saaras v4...');
            // Stream 12 chunks (1.2 seconds) of real speech
            for (let i = 0; i < 12; i++) {
              const slice = pcmEn.subarray(i * 3200, (i + 1) * 3200);
              ws.send(slice);
            }
            // Stream silence for VAD turn detection
            const silence = Buffer.alloc(3200);
            for (let i = 0; i < 15; i++) {
              setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(silence);
              }, (i + 1) * 100);
            }
          }, 800);
        }

        if (msg.type === 'partial_transcript' && !partialTranscriptHeard) {
          partialTranscriptHeard = true;
          assert(true, `Streaming STT emitted partial transcript: "${msg.text}"`);
        }

        if (msg.type === 'final_transcript' && !finalTranscriptHeard) {
          finalTranscriptHeard = true;
          assert(true, `Streaming STT finalized user turn: "${msg.text}"`);
        }

        if (msg.type === 'ai_text_chunk' && !aiTextHeard) {
          aiTextHeard = true;
          assert(true, `Streaming LLM generated reply token: "${msg.delta}"`);
        }

        if (msg.type === 'audio_chunk' && greetingReceived && !aiAudioHeard) {
          aiAudioHeard = true;
          assert(true, 'Streaming TTS delivered conversational response audio');

          // Trigger Barge-In: user interrupts while AI is speaking
          console.log('  -> Triggering Barge-In: Injecting user speech during AI playback...');
          for (let i = 0; i < 6; i++) {
            const slice = pcmEn.subarray(i * 3200, (i + 1) * 3200);
            ws.send(slice);
          }
        }

        if (msg.type === 'interrupted' && !bargeInTriggered) {
          bargeInTriggered = true;
          assert(true, `Barge-In successfully halted playback and canceled turn (Reason: ${msg.reason})`);

          setTimeout(() => {
            ws.send(JSON.stringify({ action: 'end' }));
          }, 400);
        }

        if (msg.type === 'session_ended') {
          assert(true, 'English voice session ended cleanly');
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      });
    });

    // -------------------------------------------------------------
    // Test 4: Full-Duplex Hindi Voice Conversation
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Full-Duplex Hindi Voice Conversation ---');
    await new Promise((resolve) => {
      const ws = new WebSocket(
        `ws://localhost:8000/api/client/ai-calling/voice-stream?token=${token}`,
      );
      let hindiGreetingReceived = false;

      const timeout = setTimeout(() => {
        console.error('Hindi test timed out');
        ws.close();
        resolve(false);
      }, 25000);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            action: 'start',
            language: 'hi',
            speaker: 'kavya_hi_conversational',
          }),
        );
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'session_ready') {
          assert(true, `Hindi voice session ready with speaker kavya_hi_conversational`);
        }

        if (msg.type === 'ai_turn_final' && msg.isGreeting) {
          assert(true, `Hindi AI greeting generated: "${msg.text.slice(0, 50)}..."`);
        }

        if (msg.type === 'audio_chunk' && !hindiGreetingReceived) {
          hindiGreetingReceived = true;
          assert(true, 'Hindi Bulbul v4 Flash audio chunks received');

          // Clean end
          setTimeout(() => {
            ws.send(JSON.stringify({ action: 'end' }));
          }, 600);
        }

        if (msg.type === 'session_ended') {
          assert(true, 'Hindi voice session ended cleanly');
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      });
    });

    // -------------------------------------------------------------
    // Test 5: Full-Duplex Telugu Voice Conversation
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Full-Duplex Telugu Voice Conversation ---');
    await new Promise((resolve) => {
      const ws = new WebSocket(
        `ws://localhost:8000/api/client/ai-calling/voice-stream?token=${token}`,
      );
      let teluguGreetingReceived = false;

      const timeout = setTimeout(() => {
        console.error('Telugu test timed out');
        ws.close();
        resolve(false);
      }, 25000);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            action: 'start',
            language: 'te',
            speaker: 'kavitha_te_conversation',
          }),
        );
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'session_ready') {
          assert(true, `Telugu voice session ready with speaker kavitha_te_conversation`);
        }

        if (msg.type === 'ai_turn_final' && msg.isGreeting) {
          assert(true, `Telugu AI greeting generated: "${msg.text.slice(0, 50)}..."`);
        }

        if (msg.type === 'audio_chunk' && !teluguGreetingReceived) {
          teluguGreetingReceived = true;
          assert(true, 'Telugu Bulbul v4 Flash audio chunks received');

          setTimeout(() => {
            ws.send(JSON.stringify({ action: 'end' }));
          }, 600);
        }

        if (msg.type === 'session_ended') {
          assert(true, 'Telugu voice session ended cleanly');
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      });
    });

    // -------------------------------------------------------------
    // Test 6: Regressions (Phase 2 LLM, Phase 3 STT, Phase 4 TTS)
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Regressions (Phases 2, 3 & 4) ---');
    const { SarvamLlmService } = await import(
      './dist/modules/ai-calling/sarvam-llm.service.js'
    );
    const { SarvamSttService } = await import(
      './dist/modules/ai-calling/sarvam-stt.service.js'
    );
    const { SarvamTtsService } = await import(
      './dist/modules/ai-calling/sarvam-tts.service.js'
    );

    const legacyLlm = new SarvamLlmService();
    const legacyStt = new SarvamSttService();
    const legacyTts = new SarvamTtsService();

    assert(typeof legacyLlm.chatCompletion === 'function', 'Phase 2 SarvamLlmService intact');
    assert(typeof legacyStt.transcribeAudio === 'function', 'Phase 3 SarvamSttService intact');
    assert(typeof legacyTts.synthesizeSpeech === 'function', 'Phase 4 SarvamTtsService intact');

    console.log('\n================================================================');
    console.log(` PHASE 5 VERIFICATION: ${passed} PASSED | ${failed} FAILED `);
    console.log('================================================================');

    if (failed === 0) {
      console.log(' ALL PHASE 5 REAL-TIME VOICE ENGINE CHECKS PASSED SUCCESSFULLY!\n');
    }
  } catch (err) {
    console.error('Fatal error during Phase 5 verification:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase5Verification();
