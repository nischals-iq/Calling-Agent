import 'dotenv/config';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';

async function verifyAudioReady() {
  console.log('Testing audio_ready & playback lifecycle...');
  const tenantUser = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN' },
  });

  const token = jwt.sign(
    { sub: tenantUser.id, email: tenantUser.email, clientId: tenantUser.clientId, role: tenantUser.role },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:8000/api/client/ai-calling/voice-stream?token=${encodeURIComponent(token)}`);
    let greetingAudioReadyReceived = false;
    let pongReceived = false;
    let stateTransitions = [];

    ws.on('open', () => {
      console.log('Connected to voice-stream');
      // Test ping
      ws.send(JSON.stringify({ action: 'ping' }));

      // Start session
      ws.send(JSON.stringify({
        action: 'start',
        language: 'en',
        speaker: 'simran_en_customer',
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'pong') {
        pongReceived = true;
        console.log('✓ Received pong heartbeat:', msg);
      } else if (msg.type === 'state_change') {
        stateTransitions.push(msg.state);
        console.log('State changed to:', msg.state);
      } else if (msg.type === 'audio_ready') {
        console.log(`✓ Received audio_ready for turn ${msg.turnId}: ${msg.byteLength} bytes, duration: ${msg.durationMs}ms`);
        const audioBuf = Buffer.from(msg.audio, 'base64');
        console.log(`  Decoded base64 bytes: ${audioBuf.length}`);
        const riff = audioBuf.subarray(0, 4).toString('ascii');
        const wave = audioBuf.subarray(8, 12).toString('ascii');
        const riffSize = audioBuf.readUInt32LE(4);
        const dataSize = audioBuf.readUInt32LE(40);
        console.log(`  RIFF: ${riff}, WAVE: ${wave}, RIFF size field: ${riffSize} (actual - 8: ${audioBuf.length - 8}), data size field: ${dataSize} (actual - 44: ${audioBuf.length - 44})`);
        
        greetingAudioReadyReceived = true;

        // Simulate client finishing playback after 500ms
        setTimeout(() => {
          console.log('Sending playback_finished to backend...');
          ws.send(JSON.stringify({ action: 'playback_finished', turnId: msg.turnId }));
        }, 500);
      } else if (msg.type === 'tts_completion') {
        console.log('TTS completion received for turn:', msg.turnId);
      }
    });

    // Check after 12 seconds
    setTimeout(() => {
      ws.close();
      const hasListening = stateTransitions.includes('LISTENING');
      const hasAiSpeaking = stateTransitions.includes('AI_SPEAKING');
      console.log('All state transitions:', stateTransitions);
      console.log(`Summary: greetingAudioReadyReceived=${greetingAudioReadyReceived}, pongReceived=${pongReceived}, hasAiSpeaking=${hasAiSpeaking}, hasListening=${hasListening}`);
      if (greetingAudioReadyReceived && pongReceived && hasListening) {
        console.log('ALL AUDIO READY & PLAYBACK LIFECYCLE CHECKS PASSED!');
        resolve(true);
      } else {
        reject(new Error('Lifecycle checks failed'));
      }
    }, 12000);
  });
}

verifyAudioReady().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
