import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import jwt from 'jsonwebtoken';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const API_URL = 'http://localhost:8000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';

async function runPhase2Verification() {
  console.log('===============================================================');
  console.log(' PHASE 2: SARVAM LLM CONVERSATION PLAYGROUND VERIFICATION ');
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
    // 1. Get primary tenant client & user for authentication
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

    console.log(`Tenant: "${tenantUser.client.name}" (${tenantUser.clientId})`);

    // -------------------------------------------------------------
    // Test 1: Start Conversation (English)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Start Conversation (English) ---');
    const startRes = await fetch(`${API_URL}/client/ai-calling/conversations/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ language: 'en' }),
    });

    assert(startRes.status === 201 || startRes.status === 200, `POST /conversations/start returns 200/201 (got ${startRes.status})`);
    const session1 = await startRes.json();
    assert(Boolean(session1.id), `Session ID generated: ${session1.id}`);
    assert(session1.status === 'ACTIVE', 'Session is ACTIVE');
    assert(session1.messages?.length >= 1, `Opening message present (${session1.messages?.[0]?.content?.slice(0, 50)}...)`);

    // -------------------------------------------------------------
    // Test 2: Multi-turn Context Retention
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Multi-turn Context Retention ---');
    // Turn 1: State name and role
    const turn1Res = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'Hello, my name is Priya Sharma and I run a real estate agency in Bangalore.' }),
    });
    const turn1Data = await turn1Res.json();
    assert(turn1Res.ok, `Turn 1 success (Latency: ${turn1Data.latencyMs}ms)`);
    console.log(`  AI Turn 1: "${turn1Data.aiResponse}"`);

    // Turn 2: Query earlier context
    const turn2Res = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'Can you remind me, what is my name and what business do I run?' }),
    });
    const turn2Data = await turn2Res.json();
    assert(turn2Res.ok, `Turn 2 success (Latency: ${turn2Data.latencyMs}ms)`);
    console.log(`  AI Turn 2: "${turn2Data.aiResponse}"`);
    const rememberedContext =
      turn2Data.aiResponse.toLowerCase().includes('priya') ||
      turn2Data.aiResponse.toLowerCase().includes('real estate');
    assert(rememberedContext, 'AI retained earlier customer context (Priya / Real Estate)');

    // -------------------------------------------------------------
    // Test 3: Zero-Fabrication Guardrail (Pricing Query)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Zero-Fabrication Pricing Guardrail ---');
    const pricingRes = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'Can you guarantee me a price of 99 rupees for the complete enterprise package?' }),
    });
    const pricingData = await pricingRes.json();
    assert(pricingRes.ok, 'Pricing question processed');
    console.log(`  AI Pricing Guardrail Response: "${pricingData.aiResponse}"`);
    // Guardrail: should not say yes/guarantee, should refer to advisor / details
    const guardrailPassed =
      !pricingData.aiResponse.toLowerCase().includes('guarantee you a price of 99') &&
      !pricingData.aiResponse.toLowerCase().includes('yes, we can offer 99');
    assert(guardrailPassed, 'Guardrail enforced: Did not fabricate or accept arbitrary pricing');

    // -------------------------------------------------------------
    // Test 4: Business Intent Recognition (Callback, Human, Opt-out)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Backend Business Intent Classification ---');
    
    // 4a. Callback
    const cbRes = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'I am busy right now, please call me tomorrow at 4pm.' }),
    });
    const cbData = await cbRes.json();
    assert(cbData.detectedIntent === 'CALLBACK', `Detected CALLBACK intent (got: ${cbData.detectedIntent})`);
    console.log(`  AI Callback Response: "${cbData.aiResponse}"`);

    // 4b. Human Handoff
    const humanRes = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'Can you connect me with a real human representative please?' }),
    });
    const humanData = await humanRes.json();
    assert(humanData.detectedIntent === 'HUMAN_HANDOFF', `Detected HUMAN_HANDOFF intent (got: ${humanData.detectedIntent})`);
    console.log(`  AI Human Handoff Response: "${humanData.aiResponse}"`);

    // 4c. Opt-Out (Do Not Call)
    const optRes = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'Do not call me again. Please remove my number from your list.' }),
    });
    const optData = await optRes.json();
    assert(optData.detectedIntent === 'OPT_OUT', `Detected OPT_OUT intent (got: ${optData.detectedIntent})`);
    assert(optData.session.status === 'ENDED', 'Session transitioned to ENDED on opt-out');
    console.log(`  AI Opt-out Response: "${optData.aiResponse}"`);

    // -------------------------------------------------------------
    // Test 5: Language Support (Hindi)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Language Support (Hindi) ---');
    const hindiStart = await fetch(`${API_URL}/client/ai-calling/conversations/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ language: 'hi' }),
    });
    const hindiSession = await hindiStart.json();
    assert(hindiSession.language === 'hi', 'Session created with language=hi');
    console.log(`  Hindi Opening: "${hindiSession.messages?.[0]?.content}"`);

    const hindiMsg = await fetch(`${API_URL}/client/ai-calling/conversations/${hindiSession.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'क्या आप मुझे अपने उत्पाद के मुख्य लाभ बता सकते हैं?' }),
    });
    const hindiMsgData = await hindiMsg.json();
    assert(hindiMsg.ok, `Hindi message response received (Latency: ${hindiMsgData.latencyMs}ms)`);
    console.log(`  Hindi Reply: "${hindiMsgData.aiResponse}"`);

    // -------------------------------------------------------------
    // Test 6: Tenant Isolation Check
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Tenant Isolation Enforcement ---');
    let foreignUser = await prisma.user.findFirst({
      where: { clientId: { not: tenantUser.clientId } },
    });
    if (!foreignUser) {
      let foreignClient = await prisma.client.findFirst({
        where: { id: { not: tenantUser.clientId } },
      });
      if (!foreignClient) {
        foreignClient = await prisma.client.create({
          data: {
            name: 'Isolation Foreign Client',
            slug: `iso-${Date.now()}`,
            status: 'ACTIVE',
          },
        });
      }
      foreignUser = await prisma.user.create({
        data: {
          clientId: foreignClient.id,
          email: `foreign_${Date.now()}@isolation.com`,
          passwordHash: 'dummy',
          firstName: 'Foreign',
          lastName: 'User',
          role: 'CLIENT_ADMIN',
        },
      });
    }

    const foreignToken = jwt.sign(
      {
        sub: foreignUser.id,
        email: foreignUser.email,
        clientId: foreignUser.clientId,
        role: foreignUser.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Foreign tenant attempts to read session1
    const crossGet = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}`, {
      headers: { Authorization: `Bearer ${foreignToken}` },
    });
    assert(crossGet.status === 403 || crossGet.status === 404, `Cross-tenant read blocked with 403/404 (got: ${crossGet.status})`);

    // Foreign tenant attempts to message session1
    const crossMsg = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${foreignToken}`,
      },
      body: JSON.stringify({ message: 'Hacking message' }),
    });
    assert(crossMsg.status === 403 || crossMsg.status === 404, `Cross-tenant message blocked with 403/404 (got: ${crossMsg.status})`);

    // -------------------------------------------------------------
    // Test 7: Reset / Delete Conversation
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Reset / Delete Conversation ---');
    const deleteRes = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(deleteRes.ok, `DELETE conversation returns 200 OK (got: ${deleteRes.status})`);

    const verifyDeleted = await fetch(`${API_URL}/client/ai-calling/conversations/${session1.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(verifyDeleted.status === 404, `Deleted conversation returns 404 Not Found (got: ${verifyDeleted.status})`);

    console.log('\n===============================================================');
    console.log(` SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('===============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase2Verification();
