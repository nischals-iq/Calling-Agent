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
const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';

const wavBuffer = fs.readFileSync('test_tts_en.wav');
const pcmBuffer = wavBuffer.subarray(44);

async function runVoiceGatewayTest() {
  console.log('================================================================');
  console.log(' PHASE 5: REAL-TIME AI VOICE CONVERSATION ENGINE GATEWAY TEST ');
  console.log(' Full-Duplex Real-Time Voice Streaming: STT + LLM + TTS + Barge-in ');
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

  const tenantUser = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN' },
    include: { client: true },
  });

  if (!tenantUser || !tenantUser.client) {
    throw new Error('No tenant admin user found');
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

  return new Promise((resolve) => {
    const wsUrl = `ws://localhost:8000/api/client/ai-calling/voice-stream?token=${token}`;
    console.log('Connecting to Voice Gateway:', wsUrl);
    const ws = new WebSocket(wsUrl);

    let greetingAudioReceived = false;
    let greetingAudioBytes = 0;
    let partialTranscriptReceived = false;
    let finalTranscriptReceived = false;
    let aiResponseTextReceived = false;
    let aiResponseAudioReceived = false;
    let bargeInInterruptionReceived = false;

    const timeout = setTimeout(() => {
      console.error('\nVoice Gateway test timed out after 40 seconds');
      ws.close();
      resolve(false);
    }, 40000);

    ws.on('open', () => {
      assert(true, 'Connected to backend Voice Gateway WebSocket');

      // 1. Start voice session
      ws.send(JSON.stringify({
        action: 'start',
        language: 'en',
        speaker: 'simran_en_customer',
      }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      console.log(`  <- Gateway event [${msg.type}]:`, JSON.stringify(msg).slice(0, 120));

      if (msg.type === 'session_ready') {
        assert(true, `Session initialized: ${msg.sessionId} (${msg.language})`);
      }

      // Check initial greeting audio chunks
      if (msg.type === 'audio_chunk' && !greetingAudioReceived) {
        greetingAudioBytes += Buffer.from(msg.audio, 'base64').length;
        if (greetingAudioBytes > 10000) {
          greetingAudioReceived = true;
          assert(true, `Received streaming AI greeting audio (${greetingAudioBytes} bytes)`);

          // Simulate user speaking after greeting
          setTimeout(() => {
            console.log('\n--- Simulating User Speech to Real-Time Voice Engine ---');
            // Stream 1.2s speech in 100ms PCM chunks (3200 bytes per chunk)
            for (let i = 0; i < 12; i++) {
              const slice = pcmBuffer.subarray(i * 3200, (i + 1) * 3200);
              ws.send(slice); // send as raw binary frame!
            }

            // Follow with silence frames for VAD to detect turn completion
            const silence = Buffer.alloc(3200);
            for (let i = 0; i < 15; i++) {
              setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(silence);
                }
              }, (i + 1) * 100);
            }
          }, 1000);
        }
      }

      if (msg.type === 'partial_transcript' && !partialTranscriptReceived) {
        partialTranscriptReceived = true;
        assert(true, `Real-time partial transcript received: "${msg.text}"`);
      }

      if (msg.type === 'final_transcript' && !finalTranscriptReceived) {
        finalTranscriptReceived = true;
        assert(true, `Real-time final transcript finalized: "${msg.text}"`);
      }

      if (msg.type === 'ai_text_chunk' && !aiResponseTextReceived) {
        aiResponseTextReceived = true;
        assert(true, `Real-time LLM token chunk received: "${msg.delta}"`);
      }

      if (msg.type === 'audio_chunk' && greetingAudioReceived && !aiResponseAudioReceived) {
        aiResponseAudioReceived = true;
        assert(true, 'Real-time AI response audio chunk received from Bulbul v4 Flash!');

        // Now test Barge-in / Interruption while AI is speaking!
        console.log('\n--- Testing Barge-in / Interruption While AI Is Speaking ---');
        // Send a burst of user speech to trigger VAD speech_start
        for (let i = 0; i < 6; i++) {
          const slice = pcmBuffer.subarray(i * 3200, (i + 1) * 3200);
          ws.send(slice);
        }
      }

      if (msg.type === 'interrupted' && !bargeInInterruptionReceived) {
        bargeInInterruptionReceived = true;
        assert(true, `Barge-In interruption triggered successfully! (Reason: ${msg.reason})`);

        // End session cleanly
        setTimeout(() => {
          console.log('\n--- Ending Voice Session ---');
          ws.send(JSON.stringify({ action: 'end' }));
        }, 500);
      }

      if (msg.type === 'session_ended') {
        assert(true, 'Voice session ended cleanly');
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      }
    });

    ws.on('error', (err) => {
      console.error('WS error:', err.message);
      assert(false, `Gateway WebSocket error: ${err.message}`);
    });

    ws.on('close', (code, reason) => {
      console.log(`Gateway WebSocket closed: code ${code}, reason: ${reason}`);
    });

  });
}

runVoiceGatewayTest().then(() => {
  prisma.$disconnect();
  process.exit(0);
});
