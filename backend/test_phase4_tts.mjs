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

async function runPhase4Verification() {
  console.log('===============================================================');
  console.log(' PHASE 4: SARVAM BULBUL TEXT-TO-SPEECH VERIFICATION SUITE ');
  console.log(' Model: bulbul:v4-flash | Speech Engine: Sarvam Bulbul v4 ');
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
    // Test 1: SarvamTtsService Unit & Catalog Validation
    // -------------------------------------------------------------
    console.log('--- TEST 1: SarvamTtsService Unit & Catalog Validation ---');
    const { SarvamTtsService, RECOMMENDED_VOICES } = await import(
      './dist/modules/ai-calling/sarvam-tts.service.js'
    );
    const ttsService = new SarvamTtsService();

    assert(typeof ttsService.synthesizeSpeech === 'function', 'SarvamTtsService implements synthesizeSpeech()');
    assert(typeof ttsService.getAvailableVoices === 'function', 'SarvamTtsService implements getAvailableVoices()');
    assert(SarvamTtsService.MAX_CHARACTERS === 2500, 'Model max limit is 2,500 characters');

    assert(Array.isArray(RECOMMENDED_VOICES['en-IN']), 'Contains English (en-IN) voice catalog');
    assert(RECOMMENDED_VOICES['en-IN'].some((v) => v.id === 'simran_en_customer'), 'English catalog includes simran_en_customer');
    assert(Array.isArray(RECOMMENDED_VOICES['hi-IN']), 'Contains Hindi (hi-IN) voice catalog');
    assert(RECOMMENDED_VOICES['hi-IN'].some((v) => v.id === 'kavya_hi_conversational'), 'Hindi catalog includes kavya_hi_conversational');
    assert(Array.isArray(RECOMMENDED_VOICES['te-IN']), 'Contains Telugu (te-IN) voice catalog');
    assert(RECOMMENDED_VOICES['te-IN'].some((v) => v.id === 'kavitha_te_conversation'), 'Telugu catalog includes kavitha_te_conversation');

    // -------------------------------------------------------------
    // Test 2: Live REST Bulbul v4-Flash Synthesis (English)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Live Sarvam Bulbul v4-Flash Speech Synthesis (English) ---');
    const enText = 'Hello, thank you for reaching Dashminds Calling Agent CRM. How can our AI assistant help you today?';
    const enStart = Date.now();
    const enResult = await ttsService.synthesizeSpeech(enText, {
      languageCode: 'en-IN',
      speaker: 'simran_en_customer',
      outputAudioCodec: 'wav',
      pace: 1.0,
    });
    const enElapsed = Date.now() - enStart;

    assert(enResult.success === true, 'English speech synthesis returned success: true');
    assert(typeof enResult.audioBase64 === 'string' && enResult.audioBase64.length > 5000, `Audio payload received (${enResult.audioBase64.length} chars base64)`);
    assert(enResult.audioMimeType === 'audio/wav', 'Audio MIME type is audio/wav');
    assert(enResult.speaker === 'simran_en_customer', 'Speaker confirmed as simran_en_customer');
    console.log(`  -> Synthesis Latency: ${enResult.latencyMs}ms (End-to-End: ${enElapsed}ms)`);

    // Verify WAV RIFF header
    const enAudioBuffer = Buffer.from(enResult.audioBase64, 'base64');
    assert(enAudioBuffer.slice(0, 4).toString('ascii') === 'RIFF', 'Valid RIFF header in generated audio');
    assert(enAudioBuffer.slice(8, 12).toString('ascii') === 'WAVE', 'Valid WAVE format in generated audio');
    fs.writeFileSync('test_tts_en.wav', enAudioBuffer);
    console.log(`  -> Saved sample audio: test_tts_en.wav (${(enAudioBuffer.length / 1024).toFixed(1)} KB)`);

    // -------------------------------------------------------------
    // Test 3: Live REST Bulbul v4-Flash Synthesis (Hindi)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Live Sarvam Bulbul v4-Flash Speech Synthesis (Hindi) ---');
    const hiText = 'नमस्ते, डैशमाइंड्स एआई कॉलिंग एजेंट में आपका स्वागत है। मैं आपकी किस प्रकार सहायता कर सकती हूँ?';
    const hiResult = await ttsService.synthesizeSpeech(hiText, {
      languageCode: 'hi-IN',
      speaker: 'kavya_hi_conversational',
      outputAudioCodec: 'wav',
      pace: 1.0,
    });

    assert(hiResult.success === true, 'Hindi speech synthesis returned success: true');
    assert(hiResult.speaker === 'kavya_hi_conversational', 'Speaker confirmed as kavya_hi_conversational');
    const hiAudioBuffer = Buffer.from(hiResult.audioBase64, 'base64');
    assert(hiAudioBuffer.slice(0, 4).toString('ascii') === 'RIFF', 'Valid RIFF header for Hindi audio');
    fs.writeFileSync('test_tts_hi.wav', hiAudioBuffer);
    console.log(`  -> Hindi Latency: ${hiResult.latencyMs}ms, Size: ${(hiAudioBuffer.length / 1024).toFixed(1)} KB`);

    // -------------------------------------------------------------
    // Test 4: Live REST Bulbul v4-Flash Synthesis (Telugu)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Live Sarvam Bulbul v4-Flash Speech Synthesis (Telugu) ---');
    const teText = 'నమస్కారం, డాష్‌మైండ్స్ కాలింగ్ ఏజెంట్‌కు స్వాగతం. ఈరోజు నేను మీకు ఎలా సహాయపడగలను?';
    const teResult = await ttsService.synthesizeSpeech(teText, {
      languageCode: 'te-IN',
      speaker: 'kavitha_te_conversation',
      outputAudioCodec: 'wav',
      pace: 1.0,
    });

    assert(teResult.success === true, 'Telugu speech synthesis returned success: true');
    assert(teResult.speaker === 'kavitha_te_conversation', 'Speaker confirmed as kavitha_te_conversation');
    const teAudioBuffer = Buffer.from(teResult.audioBase64, 'base64');
    assert(teAudioBuffer.slice(0, 4).toString('ascii') === 'RIFF', 'Valid RIFF header for Telugu audio');
    fs.writeFileSync('test_tts_te.wav', teAudioBuffer);
    console.log(`  -> Telugu Latency: ${teResult.latencyMs}ms, Size: ${(teAudioBuffer.length / 1024).toFixed(1)} KB`);

    // -------------------------------------------------------------
    // Test 5: Live REST Bulbul v4-Flash Synthesis (Mixed English-Hindi)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Live Sarvam Bulbul Speech Synthesis (Mixed English-Hindi / Hinglish) ---');
    const mixedText = 'Hello ji, kya aap hamare Calling Agent CRM package ke baare me complete details jaan-na chahte hain? Call schedule karne ke liye batayein.';
    const mixedResult = await ttsService.synthesizeSpeech(mixedText, {
      languageCode: 'hi-IN',
      speaker: 'shubh_enhi_ads',
      outputAudioCodec: 'wav',
    });

    assert(mixedResult.success === true, 'Hinglish mixed text synthesis returned success: true');
    const mixedAudioBuffer = Buffer.from(mixedResult.audioBase64, 'base64');
    assert(mixedAudioBuffer.length > 5000, `Hinglish audio generated (${(mixedAudioBuffer.length / 1024).toFixed(1)} KB)`);
    fs.writeFileSync('test_tts_mixed.wav', mixedAudioBuffer);

    // -------------------------------------------------------------
    // Test 6: Input Validation, Limits, and Error Handling
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Validation & Error Handling ---');

    // 6a: Empty text rejection
    try {
      await ttsService.synthesizeSpeech('   ');
      assert(false, 'Should reject empty text');
    } catch (err) {
      assert(err.status === 400 || err.response?.statusCode === 400, 'Rejects empty text with HTTP 400');
    }

    // 6b: Character limit enforcement (>2500 chars)
    try {
      const oversizedText = 'A'.repeat(2501);
      await ttsService.synthesizeSpeech(oversizedText);
      assert(false, 'Should reject oversized text exceeding 2,500 characters');
    } catch (err) {
      assert(err.status === 400 || err.response?.statusCode === 400, 'Rejects oversized text (>2,500 chars) with HTTP 400');
    }

    // 6c: Invalid speaker ID rejection from API
    try {
      await ttsService.synthesizeSpeech('Hello test', {
        speaker: 'non_existent_fake_speaker_123',
      });
      assert(false, 'Should reject invalid speaker ID');
    } catch (err) {
      assert(err.status === 400 || err.response?.statusCode === 400, 'Rejects invalid speaker ID with HTTP 400');
    }

    // -------------------------------------------------------------
    // Test 7: Backend Protected Endpoints (Auth Guard & Tenant Isolation)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Backend Protected Endpoints ---');

    // 7a: Unauthorized request without JWT
    const unauthRes = await fetch(`${API_URL}/client/ai-calling/speech/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello unauthorized' }),
    });
    assert(unauthRes.status === 401, 'POST /speech/synthesize rejects unauthorized request with HTTP 401');

    // 7b: Authorized request with JWT
    const authRes = await fetch(`${API_URL}/client/ai-calling/speech/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: 'This is a protected synthesis request from CallingAgent CRM tenant.',
        languageCode: 'en-IN',
        speaker: 'dev_en_conversational',
      }),
    });
    assert(authRes.status === 201, `POST /speech/synthesize returns HTTP 201 for authorized tenant (got ${authRes.status})`);
    const authData = await authRes.json();
    assert(authData.success === true, 'Endpoint returns success: true');
    assert(typeof authData.audioBase64 === 'string', 'Endpoint returns base64 audio string');
    assert(authData.speaker === 'dev_en_conversational', 'Endpoint uses requested speaker dev_en_conversational');

    // 7c: Voices catalog endpoint
    const voicesRes = await fetch(`${API_URL}/client/ai-calling/speech/voices?languageCode=hi-IN`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(voicesRes.status === 200, 'GET /speech/voices returns HTTP 200');
    const voices = await voicesRes.json();
    assert(Array.isArray(voices) && voices.length > 0, `Returned ${voices.length} Hindi voices`);
    assert(voices.some((v) => v.id === 'kavya_hi_conversational'), 'Voices catalog contains kavya_hi_conversational');

    // -------------------------------------------------------------
    // Test 8: End-to-End Pipeline: Saaras STT -> Sarvam-105B LLM -> Bulbul v4-Flash TTS
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Full End-to-End Pipeline (STT -> LLM -> TTS) ---');

    // Start a fresh conversation
    const convStartRes = await fetch(`${API_URL}/client/ai-calling/conversations/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ language: 'en' }),
    });
    assert(convStartRes.status === 201, 'Started new conversation session for pipeline test');
    const convSession = await convStartRes.json();
    const sessionId = convSession.id;

    // Send customer inquiry to Sarvam-105B LLM
    const userQuery = 'Can your AI calling system support automated lead qualification for real estate?';
    console.log(`  Customer Input: "${userQuery}"`);
    const msgStart = Date.now();
    const msgRes = await fetch(`${API_URL}/client/ai-calling/conversations/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: userQuery }),
    });
    const msgData = await msgRes.json();
    assert(msgRes.status === 201, 'Sarvam 105B LLM generated conversational response');
    const aiResponseText = msgData.aiResponse;
    console.log(`  Sarvam 105B Response (${msgData.latencyMs}ms): "${aiResponseText.slice(0, 100)}..."`);

    // Synthesize the exact AI response using Bulbul v4-Flash
    const pipelineTtsStart = Date.now();
    const pipelineTtsRes = await fetch(`${API_URL}/client/ai-calling/speech/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: aiResponseText,
        languageCode: 'en-IN',
        speaker: 'simran_en_customer',
      }),
    });
    const pipelineTtsData = await pipelineTtsRes.json();
    assert(pipelineTtsRes.status === 201, 'Bulbul v4-Flash converted AI response to speech');
    assert(pipelineTtsData.success === true, 'Pipeline TTS synthesis returned success: true');
    assert(pipelineTtsData.characterCount === aiResponseText.length, `Synthesized exact ${aiResponseText.length} characters of AI response`);
    console.log(`  Bulbul v4-Flash Synthesis Latency: ${pipelineTtsData.latencyMs}ms`);

    // Save full pipeline audio output
    const pipelineBuffer = Buffer.from(pipelineTtsData.audioBase64, 'base64');
    fs.writeFileSync('test_pipeline_output.wav', pipelineBuffer);
    console.log(`  -> Full pipeline audio saved: test_pipeline_output.wav (${(pipelineBuffer.length / 1024).toFixed(1)} KB)`);

    // -------------------------------------------------------------
    // Test 9: Phase 2 & Phase 3 Regressions
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Phase 2 (LLM Multi-Turn) & Phase 3 (STT) Regressions ---');

    // Phase 2 multi-turn memory check
    const followUpRes = await fetch(`${API_URL}/client/ai-calling/conversations/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'What pricing plans do you offer for that?' }),
    });
    const followUpData = await followUpRes.json();
    assert(followUpRes.status === 201, 'Multi-turn memory persisted and generated follow-up response');
    assert(followUpData.session.messages.length >= 5, `Session has ${followUpData.session.messages.length} messages in conversation history`);

    // Phase 3 STT regression check
    const { SarvamSttService } = await import('./dist/modules/ai-calling/sarvam-stt.service.js');
    const sttService = new SarvamSttService();
    assert(typeof sttService.transcribeAudio === 'function', 'Sarvam Saaras STT service remains intact');

    console.log('\n===============================================================');
    console.log(` VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED `);
    console.log('===============================================================');

    if (failed === 0) {
      console.log(' ALL PHASE 4 SARVAM BULBUL TTS CHECKS PASSED SUCCESSFULLY!\n');
    }
  } catch (err) {
    console.error('Fatal error during Phase 4 verification:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase4Verification();
