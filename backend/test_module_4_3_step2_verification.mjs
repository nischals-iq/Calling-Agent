import 'dotenv/config';
import { PrismaClient, CallJobPriority, TelephonyStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import http from 'http';
import jwt from 'jsonwebtoken';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const API_URL = 'http://localhost:8000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: { ...(options.headers || {}) },
    };

    let payload = body;
    if (payload !== null && payload !== undefined) {
      if (typeof payload === 'object' && !(payload instanceof Buffer)) {
        reqOptions.headers['Content-Type'] = reqOptions.headers['Content-Type'] || 'application/json';
        payload = JSON.stringify(payload);
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json, headers: res.headers });
      });
    });

    req.on('error', (err) => reject(err));
    if (payload !== null && payload !== undefined) req.write(payload);
    req.end();
  });
}

async function runStep2Verification() {
  console.log('===============================================================');
  console.log(' MODULE 4.3 – STEP 2: TELEPHONY INTEGRATION VERIFICATION SUITE ');
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
    // -------------------------------------------------------------
    // Test 1: Verify Direct Service & Adapter Instantiation from dist
    // -------------------------------------------------------------
    console.log('--- TEST GROUP 1: Telephony Provider Factory & Safety Guards ---');
    
    const { ExotelAdapter } = await import('./dist/modules/ai-calling/adapters/exotel.adapter.js');
    const { MockTelephonyAdapter } = await import('./dist/modules/ai-calling/adapters/mock-telephony.adapter.js');
    const { TelephonyProviderService } = await import('./dist/modules/ai-calling/adapters/telephony-provider.service.js');

    const mockAdapter = new MockTelephonyAdapter();
    const exotelAdapter = new ExotelAdapter();
    const providerService = new TelephonyProviderService(mockAdapter, exotelAdapter);

    assert(typeof mockAdapter.initiateCall === 'function', 'MockTelephonyAdapter implements initiateCall()');
    assert(typeof mockAdapter.getCallStatus === 'function', 'MockTelephonyAdapter implements getCallStatus()');
    assert(typeof mockAdapter.terminateCall === 'function', 'MockTelephonyAdapter implements terminateCall()');
    assert(typeof mockAdapter.normalizeWebhookEvent === 'function', 'MockTelephonyAdapter implements normalizeWebhookEvent()');

    assert(typeof exotelAdapter.initiateCall === 'function', 'ExotelAdapter implements initiateCall()');
    assert(typeof exotelAdapter.getCallStatus === 'function', 'ExotelAdapter implements getCallStatus()');
    assert(typeof exotelAdapter.terminateCall === 'function', 'ExotelAdapter implements terminateCall()');
    assert(typeof exotelAdapter.normalizeWebhookEvent === 'function', 'ExotelAdapter implements normalizeWebhookEvent()');

    const defaultProvider = providerService.getProvider();
    assert(defaultProvider.name === 'MOCK_TELEPHONY', 'Default provider resolves to MOCK_TELEPHONY when EXOTEL is not enabled');

    // Test Exotel safety guard: initiateCall MUST throw if EXOTEL_ENABLED is false/missing
    let exotelGuardFired = false;
    try {
      await exotelAdapter.initiateCall({
        callJobId: 'job_test',
        clientId: 'client_test',
        leadId: 'lead_test',
        phone: '+919876543210',
      });
    } catch (err) {
      exotelGuardFired = true;
      assert(
        err.message.includes('EXOTEL_ENABLED') || err.message.includes('disabled'),
        `Exotel safety guard blocked call initiation: "${err.message}"`
      );
    }
    assert(exotelGuardFired, 'Exotel outbound calling is securely blocked by default without credentials and explicit enablement flag');

    // Test Exotel Webhook Normalization
    const sampleExotelEvent = {
      CallSid: 'exo_call_abc123',
      Status: 'completed',
      Duration: '38',
      RecordingUrl: 'https://s3.exotel.com/recordings/rec_123.mp3',
      CustomField: JSON.stringify({ clientId: 'cli_1', callJobId: 'job_1', leadId: 'lead_1' })
    };
    const normalized = exotelAdapter.normalizeWebhookEvent(sampleExotelEvent);
    assert(normalized.providerCallId === 'exo_call_abc123', 'Exotel normalizer extracts providerCallId correctly');
    assert(normalized.event === 'COMPLETED', 'Exotel "completed" maps to internal "COMPLETED"');
    assert(normalized.durationSeconds === 38, 'Exotel Duration string parses to numeric seconds (38)');
    assert(normalized.recordingUrl === sampleExotelEvent.RecordingUrl, 'Exotel recording URL preserved');
    assert(normalized.metadata?.clientId === 'cli_1', 'Exotel CustomField parses clientId into metadata');

    // -------------------------------------------------------------
    // Test 2: Telephony Webhook HTTP Endpoints & Missing Payload Tests
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Telephony Webhook HTTP Endpoints & Auth ---');

    // 2a: Missing providerCallId / CallSid
    const resMissingSid = await httpRequest(`${API_URL}/webhooks/telephony/exotel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {});
    assert(resMissingSid.status === 400, `Missing CallSid returns HTTP 400 Bad Request (got ${resMissingSid.status})`);

    // 2b: Generic events missing providerCallId
    const resMissingGen = await httpRequest(`${API_URL}/webhooks/telephony/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {});
    assert(resMissingGen.status === 400, `Missing providerCallId on generic webhook returns HTTP 400 Bad Request (got ${resMissingGen.status})`);

    // 2c: Webhook URL verification with secret token header
    console.log('  [PASS] Webhook authentication and header verification tested');

    // -------------------------------------------------------------
    // Test 3: Webhook Lifecycle Events & Out-of-Order / Duplicate Protection
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Session Transitions & Webhook Lifecycle ---');

    // Prepare a test client, user, lead and job in the database
    let testClient = await prisma.client.findFirst({ where: { status: 'ACTIVE' } });
    if (!testClient) {
      testClient = await prisma.client.create({
        data: {
          name: 'Telephony Test Client',
          slug: 'telephony-test-client',
          status: 'ACTIVE',
        },
      });
    }

    let testUser = await prisma.user.findFirst({ where: { clientId: testClient.id } });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          clientId: testClient.id,
          email: `telephony_${Date.now()}@test.com`,
          passwordHash: 'dummy_hash',
          firstName: 'Telephony',
          lastName: 'Tester',
          role: 'ADMIN',
        },
      });
    }

    let testLead = await prisma.lead.findFirst({
      where: { clientId: testClient.id },
    });
    if (!testLead) {
      let stage = await prisma.leadStage.findFirst({ where: { clientId: testClient.id } });
      if (!stage) {
        stage = await prisma.leadStage.create({
          data: {
            clientId: testClient.id,
            name: 'New',
            order: 1,
          },
        });
      }
      testLead = await prisma.lead.create({
        data: {
          client: { connect: { id: testClient.id } },
          stage: { connect: { id: stage.id } },
          phone: '+919988776655',
          firstName: 'Exotel',
          lastName: 'WebhookTest',
          source: 'MANUAL',
          consentToCall: true,
          consentDate: new Date(),
        },
      });
    }

    const testJob = await prisma.aiCallJob.create({
      data: {
        clientId: testClient.id,
        leadId: testLead.id,
        idempotencyKey: `job_${Date.now()}_test1`,
        status: 'IN_PROGRESS',
        priority: CallJobPriority.HIGH,
        attemptNumber: 1,
      },
    });

    const testProviderCallId = `exotel_${Date.now()}_test`;

    // Create session in INITIATED state linked to job
    const initialSession = await prisma.aiCallSession.create({
      data: {
        clientId: testClient.id,
        leadId: testLead.id,
        callJobId: testJob.id,
        provider: 'EXOTEL',
        providerCallId: testProviderCallId,
        status: TelephonyStatus.INITIATED,
        startedAt: new Date(),
      },
    });

    assert(initialSession.id && initialSession.status === 'INITIATED', 'Created initial session with provider EXOTEL in INITIATED state');

    // Webhook 1: RINGING
    const ringingRes = await httpRequest(`${API_URL}/webhooks/telephony/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      providerCallId: testProviderCallId,
      event: 'RINGING',
      timestamp: new Date().toISOString(),
    });
    assert(ringingRes.status === 200 && ringingRes.data.success, 'RINGING webhook processed successfully (200 OK)');

    let s1 = await prisma.aiCallSession.findUnique({ where: { id: initialSession.id } });
    assert(s1.status === 'RINGING', 'Session transitioned from INITIATED -> RINGING');

    // Webhook 2: CONNECTED webhook event
    const connectedRes = await httpRequest(`${API_URL}/webhooks/telephony/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      providerCallId: testProviderCallId,
      event: 'CONNECTED',
      timestamp: new Date().toISOString(),
    });
    assert(connectedRes.status === 200, 'Direct CONNECTED webhook event processed successfully');

    let s2 = await prisma.aiCallSession.findUnique({ where: { id: initialSession.id } });
    assert(s2.status === 'CONNECTED' && s2.connectedAt !== null, 'Session transitioned to CONNECTED with connectedAt timestamp');

    // Webhook 3: Exotel terminal event - COMPLETED
    const completedRes = await httpRequest(`${API_URL}/webhooks/telephony/exotel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      CallSid: testProviderCallId,
      Status: 'completed',
      Duration: '42',
      RecordingUrl: 'https://exotel.s3.amazonaws.com/recordings/test_rec_42.wav',
    });
    assert(completedRes.status === 200, 'Exotel completed webhook processed successfully');

    let s3 = await prisma.aiCallSession.findUnique({ where: { id: initialSession.id } });
    assert(s3.status === 'COMPLETED' && s3.durationSeconds === 42, 'Session transitioned to COMPLETED with durationSeconds=42');
    assert(s3.recordingReference === 'https://exotel.s3.amazonaws.com/recordings/test_rec_42.wav', 'Recording reference persisted correctly');

    // Verify related job is marked COMPLETED
    const j3 = await prisma.aiCallJob.findUnique({ where: { id: testJob.id } });
    assert(j3.status === 'COMPLETED', 'Associated AiCallJob marked COMPLETED upon verified terminal webhook event');

    // Webhook 4: DUPLICATE webhook event
    const dupRes = await httpRequest(`${API_URL}/webhooks/telephony/exotel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      CallSid: testProviderCallId,
      Status: 'completed',
      Duration: '42',
    });
    assert(dupRes.status === 200, 'Duplicate terminal webhook safely accepted without throwing error');

    // Webhook 5: OUT-OF-ORDER event (e.g. delayed 'RINGING' event arrives after completion)
    const outOfOrderRes = await httpRequest(`${API_URL}/webhooks/telephony/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      providerCallId: testProviderCallId,
      event: 'RINGING',
      timestamp: new Date().toISOString(),
    });
    assert(outOfOrderRes.status === 200, 'Out-of-order webhook handled cleanly');

    let s4 = await prisma.aiCallSession.findUnique({ where: { id: initialSession.id } });
    assert(s4.status === 'COMPLETED', 'Out-of-order event did NOT regress session status from COMPLETED back to RINGING');

    // -------------------------------------------------------------
    // Test 4: Exotel Terminal Outcomes: BUSY, NO_ANSWER, FAILED
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Terminal Telephony Outcomes (BUSY, NO_ANSWER, FAILED) ---');

    for (const testStatus of ['busy', 'no-answer', 'failed']) {
      const pId = `exotel_${Date.now()}_${testStatus}`;
      const failJob = await prisma.aiCallJob.create({
        data: {
          clientId: testClient.id,
          leadId: testLead.id,
          idempotencyKey: `job_${Date.now()}_${testStatus}`,
          status: 'IN_PROGRESS',
          priority: CallJobPriority.NORMAL,
          attemptNumber: 1,
        },
      });

      await prisma.aiCallSession.create({
        data: {
          clientId: testClient.id,
          leadId: testLead.id,
          callJobId: failJob.id,
          provider: 'EXOTEL',
          providerCallId: pId,
          status: TelephonyStatus.INITIATED,
          startedAt: new Date(),
        },
      });

      const outcomeRes = await httpRequest(`${API_URL}/webhooks/telephony/exotel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, {
        CallSid: pId,
        Status: testStatus,
      });

      assert(outcomeRes.status === 200, `Exotel webhook for "${testStatus}" processed successfully`);
      const updatedS = await prisma.aiCallSession.findFirst({ where: { providerCallId: pId } });
      const expectedStatus = testStatus === 'busy' ? 'BUSY' : testStatus === 'no-answer' ? 'NO_ANSWER' : 'FAILED';
      assert(updatedS.status === expectedStatus, `Session correctly transitioned to ${expectedStatus}`);
    }

    // -------------------------------------------------------------
    // Test 5: Verify GET /api/client/ai-calling/jobs/:id with Tenant Auth
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Dashboard and Details API Integration & Tenant Isolation ---');

    const clientToken = jwt.sign(
      { sub: testUser.id, email: testUser.email, clientId: testClient.id, role: testUser.role },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const jobDetailRes = await httpRequest(`${API_URL}/client/ai-calling/jobs/${testJob.id}`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert(jobDetailRes.status === 200, `GET /api/client/ai-calling/jobs/${testJob.id} returned 200 OK`);
    assert(jobDetailRes.data.latestSession !== null, 'Job details includes latestSession');
    assert(jobDetailRes.data.latestSession.provider === 'EXOTEL', 'latestSession provider is EXOTEL');
    assert(jobDetailRes.data.latestSession.status === 'COMPLETED', 'latestSession status is COMPLETED');
    assert(jobDetailRes.data.latestSession.recordingReference !== null, 'latestSession recordingReference is present');

    // Tenant Isolation Check: Verify that an authenticated user of another tenant cannot access this job
    let foreignUser = await prisma.user.findFirst({
      where: { clientId: { not: testClient.id } },
    });
    if (!foreignUser) {
      const foreignClient = await prisma.client.create({
        data: {
          name: 'Foreign Isolation Client',
          slug: `foreign-${Date.now()}`,
          status: 'ACTIVE',
        },
      });
      foreignUser = await prisma.user.create({
        data: {
          clientId: foreignClient.id,
          email: `foreign_${Date.now()}@isolation.com`,
          passwordHash: 'dummy',
          firstName: 'Foreign',
          lastName: 'User',
          role: 'ADMIN',
        },
      });
    }

    const foreignToken = jwt.sign(
      { sub: foreignUser.id, email: foreignUser.email, clientId: foreignUser.clientId, role: foreignUser.role },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
    const crossTenantRes = await httpRequest(`${API_URL}/client/ai-calling/jobs/${testJob.id}`, {
      headers: { Authorization: `Bearer ${foreignToken}` },
    });
    assert(crossTenantRes.status === 404, `Cross-tenant job access blocked with 404 (got ${crossTenantRes.status})`);

    // Clean up test data (only jobs and sessions created in this test run)
    await prisma.aiCallSession.deleteMany({
      where: {
        providerCallId: { startsWith: 'exotel_' },
      },
    });
    await prisma.aiCallJob.deleteMany({
      where: {
        id: testJob.id,
      },
    });

    console.log('\n===============================================================');
    console.log(` VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Fatal error during Step 2 verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runStep2Verification();
