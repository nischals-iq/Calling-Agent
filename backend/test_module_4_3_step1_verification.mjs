import 'dotenv/config';
import { PrismaClient, TelephonyStatus, CallJobStatus, CallJobPriority } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { CallSessionService, CallBusinessOutcome } from './dist/modules/ai-calling/call-session.service.js';
import { randomUUID } from 'crypto';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function runStep1Verification() {
  console.log('================================================================');
  console.log(' MODULE 4.3 – STEP 1: CALL SESSION DATABASE & LIFECYCLE TESTS');
  console.log('================================================================\n');

  // Load a test tenant and lead
  const client = await prisma.client.findFirst({
    where: { status: 'ACTIVE' },
  });
  if (!client) throw new Error('No active client found in database');

  const lead = await prisma.lead.findFirst({
    where: { clientId: client.id },
  });
  if (!lead) throw new Error('No lead found for client');

  console.log(`✓ Using Client: ${client.name} (${client.id})`);
  console.log(`✓ Using Lead: ${lead.firstName} (${lead.id})\n`);

  // Create CallSessionService with real Prisma service
  const sessionService = new CallSessionService(prisma);

  // -------------------------------------------------------------
  // Test 1 & 2: Call session creation & Relationships
  // -------------------------------------------------------------
  console.log('--- Test 1 & 2: Call Session Creation & Relationships ---');
  // First create a test job
  const testJobId = randomUUID();
  const testJob = await prisma.aiCallJob.create({
    data: {
      id: testJobId,
      clientId: client.id,
      leadId: lead.id,
      status: CallJobStatus.IN_PROGRESS,
      priority: CallJobPriority.HIGH,
      attemptNumber: 1,
      idempotencyKey: `test:step1:job:${testJobId}`,
    },
  });

  const providerCallId1 = `mock_step1_${randomUUID()}`;
  const session1 = await sessionService.createSession({
    clientId: client.id,
    leadId: lead.id,
    callJobId: testJob.id,
    provider: 'MOCK_TELEPHONY',
    providerCallId: providerCallId1,
    languageUsed: 'hi',
    metadata: { isSimulated: true, testSuite: 'Step1' },
  });

  if (!session1 || session1.status !== TelephonyStatus.INITIATED) {
    throw new Error('Failed to create session with INITIATED status');
  }
  if (session1.clientId !== client.id || session1.leadId !== lead.id || session1.callJobId !== testJob.id) {
    throw new Error('Foreign key relationships mismatch in session1');
  }
  console.log(`✓ Created AiCallSession: ID=${session1.id}, Status=${session1.status}, Provider=${session1.provider}`);
  console.log(`✓ Verified relations: Linked to Client ${session1.clientId}, Lead ${session1.leadId}, Job ${session1.callJobId}`);

  // -------------------------------------------------------------
  // Test 3 & 4: Controlled Status Transitions & Decoupled Outcome
  // -------------------------------------------------------------
  console.log('\n--- Test 3 & 4: Status Transitions & Decoupled Outcome ---');
  // 1. INITIATED -> RINGING
  const ringingRes = await sessionService.handleWebhookEvent({
    providerCallId: providerCallId1,
    event: 'RINGING',
    timestamp: new Date().toISOString(),
  });
  if (ringingRes.session.status !== TelephonyStatus.RINGING) {
    throw new Error(`Expected RINGING, got ${ringingRes.session.status}`);
  }
  console.log(`✓ Transitioned: INITIATED -> RINGING`);

  // 2. RINGING -> CONNECTED
  const connectedRes = await sessionService.handleWebhookEvent({
    providerCallId: providerCallId1,
    event: 'CONNECTED',
    timestamp: new Date().toISOString(),
  });
  if (connectedRes.session.status !== TelephonyStatus.CONNECTED || !connectedRes.session.connectedAt) {
    throw new Error(`Expected CONNECTED with connectedAt timestamp`);
  }
  console.log(`✓ Transitioned: RINGING -> CONNECTED (connectedAt: ${connectedRes.session.connectedAt.toISOString()})`);

  // 3. CONNECTED -> COMPLETED with Business Outcome QUALIFIED
  const completedRes = await sessionService.handleWebhookEvent({
    providerCallId: providerCallId1,
    event: 'COMPLETED',
    timestamp: new Date().toISOString(),
    durationSeconds: 15,
    outcome: CallBusinessOutcome.QUALIFIED,
    recordingUrl: 'https://storage.callingagent.ai/recordings/test1.wav',
  });
  if (
    completedRes.session.status !== TelephonyStatus.COMPLETED ||
    completedRes.session.outcome !== CallBusinessOutcome.QUALIFIED ||
    completedRes.session.durationSeconds !== 15
  ) {
    throw new Error(`Session completion data mismatch`);
  }
  console.log(`✓ Transitioned: CONNECTED -> COMPLETED`);
  console.log(`✓ Decoupled Business Outcome: TelephonyStatus=${completedRes.session.status}, BusinessOutcome=${completedRes.session.outcome}`);
  console.log(`✓ Talk Duration: ${completedRes.session.durationSeconds}s, Recording: ${completedRes.session.recordingReference}`);

  // -------------------------------------------------------------
  // Test 5: Duplicate Event Prevention
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Duplicate Event Prevention ---');
  const duplicateRes = await sessionService.handleWebhookEvent({
    providerCallId: providerCallId1,
    event: 'COMPLETED',
  });
  if (!duplicateRes.duplicate || duplicateRes.ignored) {
    throw new Error('Expected duplicate flag true and ignored false');
  }
  console.log(`✓ Duplicate COMPLETED event detected and handled idempotently: ${duplicateRes.message}`);

  // -------------------------------------------------------------
  // Test 6: Out-of-Order Event Handling
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Out-of-Order Event Handling ---');
  // Attempt to send RINGING to a session that is already COMPLETED
  const outOfOrderRes = await sessionService.handleWebhookEvent({
    providerCallId: providerCallId1,
    event: 'RINGING',
  });
  if (!outOfOrderRes.ignored) {
    throw new Error('Expected out-of-order event to be rejected/ignored');
  }
  console.log(`✓ Out-of-order event rejected correctly: reason=${outOfOrderRes.reason}, message=${outOfOrderRes.message}`);

  // -------------------------------------------------------------
  // Test 7: Terminal Status Protection
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Terminal Status Protection ---');
  // Attempt to transition COMPLETED session to FAILED or BUSY
  const overwriteRes = await sessionService.handleWebhookEvent({
    providerCallId: providerCallId1,
    event: 'FAILED',
    reason: 'Carrier delayed error',
  });
  if (!overwriteRes.ignored || overwriteRes.reason !== 'ALREADY_TERMINAL') {
    throw new Error(`Expected ALREADY_TERMINAL rejection, got ${overwriteRes.reason}`);
  }
  console.log(`✓ Terminal status protection verified: Cannot overwrite COMPLETED with FAILED (${overwriteRes.message})`);

  // -------------------------------------------------------------
  // Test 8: Multiple Call Attempts for One Lead & Failure Reason
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Multiple Call Attempts & Failure Reason ---');
  // Create second session on same job (Attempt #2)
  const providerCallId2 = `mock_step1_attempt2_${randomUUID()}`;
  const session2 = await sessionService.createSession({
    clientId: client.id,
    leadId: lead.id,
    callJobId: testJob.id,
    provider: 'MOCK_TELEPHONY',
    providerCallId: providerCallId2,
    metadata: { attempt: 2 },
  });

  await sessionService.handleWebhookEvent({
    providerCallId: providerCallId2,
    event: 'RINGING',
  });

  const busyRes = await sessionService.handleWebhookEvent({
    providerCallId: providerCallId2,
    event: 'BUSY',
    reason: 'Line was busy / user rejected call',
    outcome: CallBusinessOutcome.BUSY,
  });

  if (busyRes.session.status !== TelephonyStatus.BUSY || busyRes.session.failureReason !== 'Line was busy / user rejected call') {
    throw new Error(`Session 2 busy outcome/failureReason mismatch: ${busyRes.session.failureReason}`);
  }
  console.log(`✓ Attempt #2 Session created (ID=${session2.id}) with TelephonyStatus=BUSY, failureReason="${busyRes.session.failureReason}"`);

  // Verify job now has 2 distinct sessions preserved in database
  const jobSessions = await sessionService.getSessionsForJob(testJob.id, client.id);
  if (jobSessions.length !== 2) {
    throw new Error(`Expected 2 sessions for job, found ${jobSessions.length}`);
  }
  console.log(`✓ Verified Job ${testJob.id} retains all ${jobSessions.length} historical attempt sessions without overwrite`);

  // -------------------------------------------------------------
  // Test 9: Call Message (Transcript) Storage
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Call Message / Transcript Turn Storage ---');
  const msg1 = await sessionService.addMessage({
    sessionId: session1.id,
    speaker: 'AGENT',
    transcriptText: 'Namaste! Main Dashminds se call kar raha hoon. Kya aap baat kar sakte hain?',
    languageCode: 'hi',
    turnOrder: 1,
  });

  const msg2 = await sessionService.addMessage({
    sessionId: session1.id,
    speaker: 'PROSPECT',
    transcriptText: 'Haan ji, bataiye.',
    languageCode: 'hi',
    turnOrder: 2,
  });

  if (!msg1.id || !msg2.id || msg1.turnOrder !== 1 || msg2.turnOrder !== 2) {
    throw new Error('Failed to record transcript messages correctly');
  }

  const fetchedSession = await sessionService.getSessionByProviderCallId(providerCallId1);
  if (!fetchedSession.messages || fetchedSession.messages.length < 2) {
    throw new Error(`Expected at least 2 messages on session, got ${fetchedSession.messages?.length}`);
  }
  console.log(`✓ Stored and retrieved ${fetchedSession.messages.length} transcript messages in turn order:`);
  for (const m of fetchedSession.messages) {
    console.log(`   Turn #${m.turnOrder} [${m.speaker}]: "${m.transcriptText}" (${m.languageCode})`);
  }

  // -------------------------------------------------------------
  // Test 10: Cleanup of test fixture
  // -------------------------------------------------------------
  await prisma.aiCallJob.delete({ where: { id: testJob.id } });
  console.log(`\n✓ Cleaned up test fixture job ${testJob.id} (Cascade deleted sessions & messages)`);

  console.log('\n================================================================');
  console.log(' ALL 10 MODULE 4.3 STEP 1 VERIFICATION TESTS PASSED (100%)');
  console.log('================================================================\n');
}

runStep1Verification()
  .catch((err) => {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
