import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import jwt from 'jsonwebtoken';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const API_URL = 'http://localhost:8000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';

// Helper to generate synthetic WAV buffer of a given duration and frequency
function createWavBuffer(durationSeconds = 1, sampleRate = 16000, freq = 440) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels (1 mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Generate sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 16000;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  return buffer;
}

async function runPhase3Verification() {
  console.log('===============================================================');
  console.log(' PHASE 3: SARVAM SAARAS SPEECH-TO-TEXT VERIFICATION SUITE ');
  console.log('===============================================================\n');

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
    // Test 1: Direct SarvamSttService Instantiation & Validation
    // -------------------------------------------------------------
    console.log('--- TEST 1: SarvamSttService Unit Validation ---');
    const { SarvamSttService } = await import('./dist/modules/ai-calling/sarvam-stt.service.js');
    const sttService = new SarvamSttService();

    assert(typeof sttService.transcribeAudio === 'function', 'SarvamSttService implements transcribeAudio()');
    assert(SarvamSttService.MAX_DURATION_SECONDS === 30, 'REST duration limit is 30 seconds');
    assert(SarvamSttService.SUPPORTED_MIME_TYPES.has('audio/webm'), 'Supports audio/webm container');
    assert(SarvamSttService.SUPPORTED_MIME_TYPES.has('audio/wav'), 'Supports audio/wav container');

    // -------------------------------------------------------------
    // Test 2: Live REST Endpoint Audio Transcription (English)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Speech-to-Text Transcription via Endpoint (English) ---');
    let englishAudioBuffer;
    if (fs.existsSync('test_speech_en.wav')) {
      englishAudioBuffer = fs.readFileSync('test_speech_en.wav');
    } else {
      englishAudioBuffer = createWavBuffer(2, 16000, 300);
    }

    const formDataEn = new FormData();
    formDataEn.append('file', new Blob([englishAudioBuffer], { type: 'audio/wav' }), 'test_speech_en.wav');
    formDataEn.append('languageCode', 'en-IN');
    formDataEn.append('mode', 'transcribe');

    const resEn = await fetch(`${API_URL}/client/ai-calling/speech/transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formDataEn,
    });

    assert(resEn.status === 200 || resEn.status === 201, `POST /speech/transcribe returns 200 OK (got ${resEn.status})`);
    const sttResultEn = await resEn.json();
    assert(sttResultEn.success === true, 'Transcription marked success: true');
    assert(Boolean(sttResultEn.transcript), `Transcript produced: "${sttResultEn.transcript}"`);
    assert(sttResultEn.languageCode === 'en-IN' || Boolean(sttResultEn.languageCode), `Language identified: ${sttResultEn.languageCode}`);
    console.log(`  Transcription Latency: ${sttResultEn.latencyMs} ms`);

    // -------------------------------------------------------------
    // Test 3: Language Specification & Direct STT Service (Hindi & Telugu)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Multilingual STT Capabilities ---');
    // Test silent/tone audio with hi-IN language hint
    const toneBuffer = createWavBuffer(1.5, 16000, 440);
    const hiResult = await sttService.transcribeAudio(toneBuffer, 'tone_hi.wav', 'audio/wav', {
      languageCode: 'hi-IN',
    });
    assert(hiResult.success === true, 'Hindi language query processed without errors');
    assert(hiResult.languageCode === 'hi-IN' || Boolean(hiResult.languageCode), `Returned language metadata: ${hiResult.languageCode}`);

    // Test with te-IN language hint
    const teResult = await sttService.transcribeAudio(toneBuffer, 'tone_te.wav', 'audio/wav', {
      languageCode: 'te-IN',
    });
    assert(teResult.success === true, 'Telugu language query processed without errors');
    assert(teResult.languageCode === 'te-IN' || Boolean(teResult.languageCode), `Returned language metadata: ${teResult.languageCode}`);

    // -------------------------------------------------------------
    // Test 4: Audio Validation & Boundary Rejections
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Validation & Rejection of Invalid Audio ---');

    // 4a: Missing audio file
    const emptyForm = new FormData();
    const resNoFile = await fetch(`${API_URL}/client/ai-calling/speech/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: emptyForm,
    });
    assert(resNoFile.status === 400, `Missing file returns HTTP 400 Bad Request (got ${resNoFile.status})`);

    // 4b: Unsupported file type (.txt)
    const badForm = new FormData();
    badForm.append('file', new Blob([Buffer.from('not an audio file')], { type: 'text/plain' }), 'test.txt');
    const resBadType = await fetch(`${API_URL}/client/ai-calling/speech/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: badForm,
    });
    assert(resBadType.status === 400, `Unsupported file format returns HTTP 400 Bad Request (got ${resBadType.status})`);

    // 4c: Over-duration audio rejection (>30s)
    const overDurationBuffer = createWavBuffer(35, 16000, 440); // 35 seconds
    const overDurationForm = new FormData();
    overDurationForm.append('file', new Blob([overDurationBuffer], { type: 'audio/wav' }), 'over_30s.wav');
    const resOverDuration = await fetch(`${API_URL}/client/ai-calling/speech/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: overDurationForm,
    });
    assert(resOverDuration.status === 400, `Audio exceeding 30s limit returns HTTP 400 Bad Request (got ${resOverDuration.status})`);

    // -------------------------------------------------------------
    // Test 5: Tenant Authorization Enforcement on STT Endpoint
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Tenant Authorization on STT Endpoint ---');
    const unauthRes = await fetch(`${API_URL}/client/ai-calling/speech/transcribe`, {
      method: 'POST',
      body: formDataEn,
    });
    assert(unauthRes.status === 401, `Unauthenticated STT call returns HTTP 401 (got ${unauthRes.status})`);

    // -------------------------------------------------------------
    // Test 6: End-to-End Pipeline: Audio -> STT -> Review -> LLM Turn
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: End-to-End Pipeline (STT Transcript to LLM Conversation) ---');
    // Step A: Start simulated conversation session
    const startRes = await fetch(`${API_URL}/client/ai-calling/conversations/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ language: 'en' }),
    });
    const session = await startRes.json();
    assert(session.status === 'ACTIVE', `Conversation session created: ${session.id}`);

    // Step B: Submit transcribed text to existing LLM message endpoint
    const spokenMessage = sttResultEn.transcript || 'Hello, I am testing speech to text recognition with Sarvam Saaras.';
    console.log(`  Submitting transcribed customer text to LLM: "${spokenMessage}"`);

    const llmTurnRes = await fetch(`${API_URL}/client/ai-calling/conversations/${session.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: spokenMessage }),
    });

    assert(llmTurnRes.ok, `LLM turn processed successfully (HTTP ${llmTurnRes.status})`);
    const llmTurnData = await llmTurnRes.json();
    assert(Boolean(llmTurnData.aiResponse), `LLM Response generated: "${llmTurnData.aiResponse}"`);
    assert(llmTurnData.session.messages.length >= 3, `Multi-turn conversation history preserved (${llmTurnData.session.messages.length} messages)`);

    // Step C: Verify multi-turn follow-up text turn still works
    const followUpRes = await fetch(`${API_URL}/client/ai-calling/conversations/${session.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'What was the first thing I asked you about?' }),
    });
    const followUpData = await followUpRes.json();
    assert(followUpRes.ok, 'Follow-up text turn completed');
    console.log(`  Follow-up AI Response: "${followUpData.aiResponse}"`);

    // Clean up session
    await fetch(`${API_URL}/client/ai-calling/conversations/${session.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('\n===============================================================');
    console.log(` SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('===============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error in Phase 3 verification:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase3Verification();
