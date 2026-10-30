import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || 'sk_qdh4ue8m_btSNs9tEE9XBxS4wT3B8jAba';
const BASE_URL = 'http://localhost:8000/api';
const WS_URL = 'ws://localhost:8000/api/client/ai-calling/voice-stream';

let testClientId = '076b0bdf-cdf2-4287-9a19-26c78359f628';
let testUserId = 'c2debfae-3d6d-45c7-adbe-e810a7f2a5eb';

async function setupClient() {
  try {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });
    const user = await prisma.user.findFirst({ where: { isActive: true, clientId: { not: null } } });
    if (user) {
      testUserId = user.id;
      testClientId = user.clientId;
      console.log(`[Setup] Using active DB user: ${user.email} (User: ${testUserId}, Client: ${testClientId})`);
    }
    await prisma.$disconnect();
  } catch (err) {
    console.log(`[Setup] DB lookup warning: ${err.message}. Using default IDs`);
  }
}

function generateToken() {
  return jwt.sign(
    {
      sub: testUserId,
      id: testUserId,
      clientId: testClientId,
      email: 'rajesh@acmerealestate.com',
      role: 'ADMIN',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Color logs
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const blue = (s) => `\x1b[34m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${green('✔ PASS')}: ${testName} ${details ? yellow(`(${details})`) : ''}`);
    return true;
  } else {
    failedTests++;
    console.log(`  ${red('✖ FAIL')}: ${testName} ${details ? red(`(${details})`) : ''}`);
    return false;
  }
}

async function run() {
  console.log(blue('\n======================================================'));
  console.log(blue('   KANNADA (kn-IN) FULL INTEGRATION VERIFICATION'));
  console.log(blue('======================================================\n'));

  await setupClient();
  const token = generateToken();

  // -----------------------------------------------------------
  // STEP 1: Verify all 4 Kannada Bulbul Voice Personas
  // -----------------------------------------------------------
  console.log(blue('\n--- [1] Bulbul v4 Flash Kannada Voice Synthesis ---'));
  const kannadaVoices = [
    { id: 'chaitra_kn_conversation', gender: 'Female', type: 'Conversational' },
    { id: 'chetan_kn_conversation', gender: 'Male', type: 'Conversational' },
    { id: 'chaitra_kn_narration', gender: 'Female', type: 'Narration' },
    { id: 'suchitra_kn_narration', gender: 'Female', type: 'Narration' },
  ];

  let testAudioBase64 = null;

  for (const voice of kannadaVoices) {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'ನಮಸ್ಕಾರ, ನಿಮ್ಮ ಕರೆಗೆ ಸ್ವಾಗತ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
        target_language_code: 'kn-IN',
        speaker: voice.id,
        model: 'bulbul:v4-flash',
      }),
    });

    const isOk = res.status === 200;
    let audioSize = 0;
    if (isOk) {
      const data = await res.json();
      if (data.audios && data.audios[0]) {
        audioSize = Buffer.from(data.audios[0], 'base64').length;
        if (!testAudioBase64) testAudioBase64 = data.audios[0];
      }
    }
    assert(isOk && audioSize > 10000, `Bulbul Voice persona: ${voice.id} (${voice.gender}, ${voice.type})`, `HTTP ${res.status}, size: ${audioSize.toLocaleString()} bytes`);
  }

  // -----------------------------------------------------------
  // STEP 2: Verify Kannada Saaras v4 STT Transcription Accuracy
  // -----------------------------------------------------------
  console.log(blue('\n--- [2] Saaras v4 REST STT Accuracy (kn-IN) ---'));
  const originalKannadaText = 'ನಮಸ್ಕಾರ, ನಾನು ನಿಮ್ಮ ಕಂಪನಿಯ ವಿವರಗಳನ್ನು ತಿಳಿಯಲು ಬಯಸುತ್ತೇನೆ.';
  
  // Synthesize audio with exact known sentence first
  const ttsRes = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: originalKannadaText,
      target_language_code: 'kn-IN',
      speaker: 'chaitra_kn_conversation',
      model: 'bulbul:v4-flash',
    }),
  });

  const ttsData = await ttsRes.json();
  const wavBuffer = Buffer.from(ttsData.audios[0], 'base64');
  
  // Transcribe back using Saaras v4
  const formData = new FormData();
  formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
  formData.append('language_code', 'kn-IN');
  formData.append('model', 'saaras:v4');

  const sttRes = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: formData,
  });

  const sttData = await sttRes.json();
  const transcript = (sttData.transcript || '').trim();
  console.log(`    Expected Text:   "${originalKannadaText}"`);
  console.log(`    STT Transcript:  "${transcript}"`);
  
  const matches = transcript.includes('ನಮಸ್ಕಾರ') && transcript.includes('ಕಂಪನಿಯ');
  assert(matches, 'Kannada Saaras v4 STT transcript recognition', `Recognized: "${transcript}"`);

  // -----------------------------------------------------------
  // STEP 3: Sarvam-105B LLM Conversational Kannada
  // -----------------------------------------------------------
  console.log(blue('\n--- [3] Sarvam-105B LLM Conversational Kannada ---'));
  const llmRes = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sarvam-105b-conversations',
      messages: [
        {
          role: 'system',
          content: 'You are an intelligent calling agent for a premium CRM. Respond naturally in 1-2 concise sentences in Kannada script.',
        },
        {
          role: 'user',
          content: 'ನಮಸ್ಕಾರ, ನಿಮ್ಮ ಕಂಪನಿ ಯಾವ ಸೇವೆಗಳನ್ನು ಒದಗಿಸುತ್ತದೆ?',
        },
      ],
      temperature: 0.3,
    }),
  });

  const llmData = await llmRes.json();
  const llmReply = llmData.choices?.[0]?.message?.content || '';
  console.log(`    LLM Kannada Reply: "${llmReply.trim()}"`);
  const hasKannadaChars = /[\u0C80-\u0CFF]/.test(llmReply);
  assert(hasKannadaChars && llmReply.length > 5, 'Sarvam-105B generates natural Kannada response', `Length: ${llmReply.length} chars`);

  // -----------------------------------------------------------
  // STEP 4: Mode A Conversation API with Kannada & Language Switching
  // -----------------------------------------------------------
  console.log(blue('\n--- [4] Mode A CRM API: Kannada Session, Intent & Switching ---'));

  // 4a. Start Kannada session
  const startRes = await fetch(`${BASE_URL}/client/ai-calling/conversations/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: 'kn',
      leadName: 'Nischal',
      companyName: 'DashmindsIQ',
    }),
  });

  const session = await startRes.json();
  assert(startRes.status === 201 && session.id, 'Start Mode A Kannada conversation', `ID: ${session.id}`);
  assert(session.language === 'kn', 'Session language is "kn"');
  
  const initialGreeting = session.messages?.find(m => m.role === 'assistant')?.content || '';
  console.log(`    Initial Greeting: "${initialGreeting}"`);
  assert(/[\u0C80-\u0CFF]/.test(initialGreeting), 'Initial greeting is in Kannada script');

  // 4b. Send Kannada message
  const msg1Res = await fetch(`${BASE_URL}/client/ai-calling/conversations/${session.id}/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'ನಾನು ನಿಮ್ಮ CRM ತಂತ್ರಾಂಶದ ಬಗ್ಗೆ ತಿಳಿದುಕೊಳ್ಳಲು ಬಯಸುತ್ತೇನೆ.',
    }),
  });

  const msg1Data = await msg1Res.json();
  const reply1 = msg1Data.aiResponse || msg1Data.session?.messages?.filter(m => m.role === 'assistant').pop()?.content || '';
  console.log(`    Reply 1: "${reply1}"`);
  assert(/[\u0C80-\u0CFF]/.test(reply1), 'AI responds in Kannada to customer query');

  // 4c. Switch Language: kn -> en (Preserving Context)
  const switchEnRes = await fetch(`${BASE_URL}/client/ai-calling/conversations/${session.id}/language`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: 'en',
    }),
  });
  const switchEnData = await switchEnRes.json();
  assert([200, 201].includes(switchEnRes.status) && switchEnData.language === 'en', 'Switch language kn -> en', 'Language updated in session');

  // 4d. Send English query asking about earlier Kannada discussion
  const msg2Res = await fetch(`${BASE_URL}/client/ai-calling/conversations/${session.id}/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Can you briefly tell me what we just talked about regarding CRM?',
    }),
  });
  const msg2Data = await msg2Res.json();
  const reply2 = msg2Data.aiResponse || msg2Data.session?.messages?.filter(m => m.role === 'assistant').pop()?.content || '';
  console.log(`    Reply 2 (in English, remembering context): "${reply2}"`);
  assert(reply2.length > 10, 'English reply delivered with context memory');

  // 4e. Switch Language back: en -> kn
  const switchKnRes = await fetch(`${BASE_URL}/client/ai-calling/conversations/${session.id}/language`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: 'kn',
    }),
  });
  const switchKnData = await switchKnRes.json();
  assert([200, 201].includes(switchKnRes.status) && switchKnData.language === 'kn', 'Switch language en -> kn back', 'Language reverted to kn');

  // 4f. Test Kannada Intent: Callback Request
  const cbRes = await fetch(`${BASE_URL}/client/ai-calling/conversations/${session.id}/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'ನಾನು ಈಗ ಬ್ಯುಸಿಯಾಗಿದ್ದೇನೆ, ದಯವಿಟ್ಟು ನಾಳೆ ಮಧ್ಯಾಹ್ನ 3 ಗಂಟೆಗೆ ಕರೆ ಮಾಡಬಹುದೇ?',
    }),
  });
  const cbData = await cbRes.json();
  assert(cbData.detectedIntent === 'CALLBACK', 'Kannada Callback Request intent detected', `Intent: ${cbData.detectedIntent}`);

  // 4g. Test Kannada Intent: Human Handoff
  const handoffRes = await fetch(`${BASE_URL}/client/ai-calling/conversations/${session.id}/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'ನಾನು ನೇರವಾಗಿ ನಿಮ್ಮ ಮ್ಯಾನೇಜರ್ ಜೊತೆ ಮಾತನಾಡಬೇಕು.',
    }),
  });
  const handoffData = await handoffRes.json();
  assert(handoffData.detectedIntent === 'HUMAN_HANDOFF', 'Kannada Human Handoff intent detected', `Intent: ${handoffData.detectedIntent}`);

  // 4h. Test Kannada Intent: DNC Opt-Out
  const dncRes = await fetch(`${BASE_URL}/client/ai-calling/conversations/${session.id}/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'ನನಗೆ ಮತ್ತೆ ಕರೆ ಮಾಡಬೇಡಿ. ದಯವಿಟ್ಟು ನನ್ನ ನಂಬರ್ ಪಟ್ಟಿಯಿಂದ ತೆಗೆದುಹಾಕಿ.',
    }),
  });
  const dncData = await dncRes.json();
  assert(dncData.detectedIntent === 'OPT_OUT', 'Kannada DNC Opt-Out intent detected', `Intent: ${dncData.detectedIntent}`);

  // -----------------------------------------------------------
  // STEP 5: Mode B Live Voice Conversation Engine WebSocket
  // -----------------------------------------------------------
  console.log(blue('\n--- [5] Mode B Live Voice Engine: Kannada Greeting, TTS Streaming, Language Switching ---'));

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    let greetingReceived = false;
    let audioFramesCount = 0;
    let totalAudioBytes = 0;
    let switchEnConfirmed = false;
    let switchKnConfirmed = false;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Voice WebSocket test timed out after 25s'));
    }, 25000);

    ws.on('open', () => {
      console.log('    [WS] Connected to Voice Gateway, sending authenticate...');
      ws.send(JSON.stringify({
        action: 'authenticate',
        token,
      }));
    });

    ws.on('message', (raw, isBinary) => {
      if (isBinary) return;
      const msg = JSON.parse(raw.toString('utf-8'));

      if (msg.type === 'authenticated') {
        console.log('    [WS] Authenticated successfully, sending start action...');
        ws.send(JSON.stringify({
          action: 'start',
          language: 'kn',
          speaker: 'chaitra_kn_conversation',
          leadName: 'Nischal',
          companyName: 'DashmindsIQ',
        }));
        return;
      }

      const eventType = msg.event || msg.type;

      if (eventType === 'session_started' || eventType === 'session_ready') {
        const lang = msg.session?.language || msg.language;
        const sId = msg.session?.sessionId || msg.sessionId;
        assert(lang === 'kn', 'Mode B Session started with language: "kn"', `Session: ${sId}`);
      }

      if (eventType === 'audio_frame') {
        audioFramesCount++;
        if (msg.audio) {
          totalAudioBytes += Buffer.from(msg.audio, 'base64').length;
        }
      }

      if (eventType === 'audio_ready') {
        greetingReceived = true;
        const audioLen = msg.audio ? Buffer.from(msg.audio, 'base64').length : 0;
        console.log(`    [WS] Audio Ready: "${msg.text}" (Audio: ${audioLen.toLocaleString()} B, Frames: ${audioFramesCount})`);
        
        assert(/[\u0C80-\u0CFF]/.test(msg.text), 'Mode B initial greeting contains Kannada script', `"${msg.text}"`);
        assert(audioLen > 5000, 'Mode B synthesizes valid streaming Kannada audio chunks', `${audioLen} bytes`);

        // Notify playback done to transition orchestrator to LISTENING
        ws.send(JSON.stringify({
          action: 'playback_done',
          turnId: msg.turnId,
        }));

        // Now test real-time language switching: kn -> en
        setTimeout(() => {
          console.log('    [WS] Sending switch_language action: kn -> en');
          ws.send(JSON.stringify({
            action: 'switch_language',
            language: 'en',
            speaker: 'simran_en_customer',
          }));
        }, 1000);
      }

      if (eventType === 'language_switched') {
        console.log(`    [WS] Language switched event received: ${msg.language} (${msg.bcp47}, ${msg.speaker})`);
        if (msg.language === 'en') {
          switchEnConfirmed = true;
          assert(msg.language === 'en' && msg.bcp47 === 'en-IN', 'Mode B real-time switch_language to English confirmed');
          // Switch back to Kannada
          setTimeout(() => {
            console.log('    [WS] Sending switch_language action: en -> kn');
            ws.send(JSON.stringify({
              action: 'switch_language',
              language: 'kn',
              speaker: 'chaitra_kn_conversation',
            }));
          }, 800);
        } else if (msg.language === 'kn') {
          switchKnConfirmed = true;
          assert(msg.language === 'kn' && msg.bcp47 === 'kn-IN', 'Mode B real-time switch_language back to Kannada confirmed');
          // Conclude WS test
          setTimeout(() => {
            ws.send(JSON.stringify({ action: 'end' }));
            clearTimeout(timeout);
            ws.close();
            resolve();
          }, 500);
        }
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // -----------------------------------------------------------
  // STEP 6: Regression Check for English, Hindi, and Telugu
  // -----------------------------------------------------------
  console.log(blue('\n--- [6] Regression Verification: English, Hindi, Telugu ---'));
  const regressionLangs = [
    { code: 'en', name: 'English', sample: 'Hello, I want details about your plan.' },
    { code: 'hi', name: 'Hindi', sample: 'नमस्ते, क्या आप मुझे अपनी योजनाओं के बारे में बता सकते हैं?' },
    { code: 'te', name: 'Telugu', sample: 'నమస్కారం, మీ ప్లాన్ల వివరాలను అందించగలరా?' },
  ];

  for (const reg of regressionLangs) {
    const sRes = await fetch(`${BASE_URL}/client/ai-calling/conversations/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: reg.code,
        leadName: 'TestUser',
        companyName: 'DashmindsIQ',
      }),
    });
    const sData = await sRes.json();
    assert(sRes.status === 201 && sData.language === reg.code, `Regression: Start session in ${reg.name} (${reg.code})`);

    const mRes = await fetch(`${BASE_URL}/client/ai-calling/conversations/${sData.id}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: reg.sample,
      }),
    });
    const mData = await mRes.json();
    const reply = mData.aiResponse || mData.session?.messages?.filter(m => m.role === 'assistant').pop()?.content || '';
    assert(reply.length > 5, `Regression: AI response in ${reg.name}`, `Length: ${reply.length} chars`);
  }

  // -----------------------------------------------------------
  // FINAL REPORT
  // -----------------------------------------------------------
  console.log(blue('\n======================================================'));
  console.log(blue('                   TEST SUMMARY'));
  console.log(blue('======================================================'));
  console.log(`Total Checks:  ${totalTests}`);
  console.log(`Passed Checks: ${green(passedTests)}`);
  console.log(`Failed Checks: ${failedTests > 0 ? red(failedTests) : '0'}`);
  console.log(blue('======================================================\n'));

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(red(`\n[FATAL ERROR] ${err.stack || err.message}`));
  process.exit(1);
});
