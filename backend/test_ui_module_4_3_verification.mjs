import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';
const BASE_URL = 'http://localhost:8000/api';

async function runVerification() {
  console.log('====================================================');
  console.log(' MODULE 4.3 AI CALLING UI & API INTEGRATION TEST');
  console.log('====================================================\n');

  // 1. Identify test tenants & users
  const user1 = await prisma.user.findFirst({
    where: { clientId: 'ece818d0-950c-480a-8873-00484c8f7ba9' },
  });
  const user2 = await prisma.user.findFirst({
    where: { clientId: 'f43a2436-bf41-4555-ab85-d974f3d5ccc4' },
  });

  if (!user1 || !user2) {
    throw new Error('Test users for tenants not found in database');
  }

  const token1 = jwt.sign(
    { sub: user1.id, email: user1.email, clientId: user1.clientId, role: user1.role },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  const token2 = jwt.sign(
    { sub: user2.id, email: user2.email, clientId: user2.clientId, role: user2.role },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  console.log('✓ Generated test JWT tokens for Tenant 1 and Tenant 2');

  // 2. Test GET /api/client/ai-calling/jobs
  console.log('\n--- Test 1: GET /api/client/ai-calling/jobs (Tenant 1) ---');
  const res1 = await fetch(`${BASE_URL}/client/ai-calling/jobs`, {
    headers: { Authorization: `Bearer ${token1}` },
  });

  if (!res1.ok) {
    throw new Error(`GET /client/ai-calling/jobs failed with status ${res1.status}: ${await res1.text()}`);
  }

  const jobs = await res1.json();
  console.log(`✓ Fetched ${jobs.length} jobs for Tenant 1`);

  const jobWithSession = jobs.find((j) => j.latestSession !== null);
  if (!jobWithSession) {
    throw new Error('Expected at least one job with latestSession');
  }

  console.log('Sample job with latestSession:');
  console.log(`  Job ID: ${jobWithSession.id}`);
  console.log(`  Lead: ${jobWithSession.leadName} (${jobWithSession.phone})`);
  console.log(`  Status: ${jobWithSession.status}`);
  console.log(`  Latest Session:`);
  console.log(`    Status: ${jobWithSession.latestSession.status}`);
  console.log(`    Provider: ${jobWithSession.latestSession.provider}`);
  console.log(`    Is Simulated: ${jobWithSession.latestSession.isSimulated}`);
  console.log(`    Duration: ${jobWithSession.latestSession.durationSeconds}s`);
  console.log(`    Outcome: ${jobWithSession.latestSession.outcome}`);

  if (jobWithSession.latestSession.provider !== 'MOCK_TELEPHONY') {
    throw new Error(`Expected provider MOCK_TELEPHONY, got ${jobWithSession.latestSession.provider}`);
  }
  if (jobWithSession.latestSession.isSimulated !== true) {
    throw new Error(`Expected isSimulated === true, got ${jobWithSession.latestSession.isSimulated}`);
  }
  console.log('✓ Verified: latestSession payload contains provider, isSimulated, duration, and outcome');

  // 3. Test GET /api/client/ai-calling/jobs/:id (Detail Endpoint)
  console.log('\n--- Test 2: GET /api/client/ai-calling/jobs/:id (Details & Transcripts) ---');
  const resDetails = await fetch(`${BASE_URL}/client/ai-calling/jobs/${jobWithSession.id}`, {
    headers: { Authorization: `Bearer ${token1}` },
  });

  if (!resDetails.ok) {
    throw new Error(`GET /client/ai-calling/jobs/:id failed with status ${resDetails.status}: ${await resDetails.text()}`);
  }

  const details = await resDetails.json();
  console.log(`✓ Loaded job details for ${details.id}`);
  console.log(`  Lead: ${details.leadName}`);
  console.log(`  Sessions count: ${details.sessions.length}`);

  if (!details.sessions || details.sessions.length === 0) {
    throw new Error('Expected at least one session in job details');
  }

  const primarySession = details.sessions[0];
  console.log(`  Primary Session ID: ${primarySession.id}`);
  console.log(`  Provider Call ID: ${primarySession.providerCallId}`);
  console.log(`  Messages count: ${primarySession.messages?.length || 0}`);

  if (!primarySession.messages || primarySession.messages.length < 2) {
    throw new Error('Expected conversation turn messages in session');
  }

  console.log('  Transcript turns:');
  for (const msg of primarySession.messages) {
    console.log(`    Turn #${msg.turnOrder} [${msg.speaker}]: "${msg.transcriptText}"`);
  }
  console.log('✓ Verified: Chronological conversation transcript turns retrieved successfully');

  // 4. Test Tenant Isolation
  console.log('\n--- Test 3: Tenant Isolation Verification ---');
  const resCrossTenant = await fetch(`${BASE_URL}/client/ai-calling/jobs/${jobWithSession.id}`, {
    headers: { Authorization: `Bearer ${token2}` }, // Tenant 2 trying to read Tenant 1's job
  });

  console.log(`Cross-tenant request returned status: ${resCrossTenant.status}`);
  if (resCrossTenant.status === 404) {
    console.log('✓ Verified: Cross-tenant access strictly prevented with 404 Not Found');
  } else {
    throw new Error(`Expected 404 for cross-tenant access, got ${resCrossTenant.status}`);
  }

  // 5. Test Live End-to-End Submission & Auto-Enqueue
  console.log('\n--- Test 4: Live Lead Submission -> Call Job -> Telephony Simulation ---');
  const testPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  const captureRes = await fetch(`${BASE_URL}/public/leads/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: user1.clientId,
      firstName: 'UiVerification',
      lastName: 'Tester',
      phone: testPhone,
      email: `tester_${Date.now()}@example.com`,
      source: 'WEBSITE',
      customFields: { consentGiven: 'YES' },
    }),
  });

  if (!captureRes.ok) {
    throw new Error(`Lead capture failed with status ${captureRes.status}: ${await captureRes.text()}`);
  }

  const captureData = await captureRes.json();
  const newLeadId = captureData.lead?.id || captureData.id;
  console.log(`✓ Ingested new lead ${newLeadId} with phone ${testPhone}`);

  // Wait for worker to pick up and process job
  console.log('Waiting 6s for worker queue progression (QUEUED -> IN_PROGRESS -> COMPLETED)...');
  await new Promise((r) => setTimeout(r, 6000));

  // Fetch updated jobs
  const resUpdated = await fetch(`${BASE_URL}/client/ai-calling/jobs`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const updatedJobs = await resUpdated.json();
  const createdJob = updatedJobs.find((j) => j.leadId === newLeadId);

  if (!createdJob) {
    throw new Error(`Created AI Call Job for lead ${newLeadId} not found`);
  }

  console.log(`✓ New AI Call Job found: ID=${createdJob.id}, status=${createdJob.status}, attempt=${createdJob.attemptNumber}`);
  if (createdJob.latestSession) {
    console.log(`✓ Session auto-created: Telephony status=${createdJob.latestSession.status}, outcome=${createdJob.latestSession.outcome}, duration=${createdJob.latestSession.durationSeconds}s`);
  }

  console.log('\n====================================================');
  console.log(' ALL MODULE 4.3 UI INTEGRATION TESTS PASSED (100%)');
  console.log('====================================================\n');
}

runVerification()
  .catch((err) => {
    console.error('\n❌ Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
