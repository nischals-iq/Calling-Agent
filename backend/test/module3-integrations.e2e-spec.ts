import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UserRole, ClientStatus, SubscriptionPlan, ChannelType, IntegrationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { IntegrationEncryptionService } from '../src/modules/integrations/services/integration-encryption.service.js';

describe('Module 3 - Part 2: External Platform Integrations & Admin Credentials (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let clientAToken: string;
  let clientBToken: string;
  let clientA: any;
  let clientB: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test events from previous runs
    await prisma.webhookLog.deleteMany({
      where: {
        payload: {
          path: ['providerEventId'],
          equals: 'meta_leadgen_event_001',
        },
      },
    });

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('Admin@123456', salt);
    const clientPassHash = await bcrypt.hash('ClientAdmin@123', salt);

    // 1. Setup Platform Superadmin
    await prisma.user.upsert({
      where: { email: 'admin@dashmindsiq.com' },
      update: { passwordHash: passHash, isActive: true, role: UserRole.PLATFORM_ADMIN },
      create: {
        name: 'Super Admin',
        email: 'admin@dashmindsiq.com',
        passwordHash: passHash,
        role: UserRole.PLATFORM_ADMIN,
        isActive: true,
      },
    });

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'admin@dashmindsiq.com', password: 'Admin@123456' });
    adminToken = adminLoginRes.body.accessToken;

    // 2. Setup Client A
    clientA = await prisma.client.create({
      data: {
        name: 'OmniChannel Agency A',
        primaryContactEmail: 'agency.a@omni.com',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.PRO,
        leadStages: {
          create: [
            { name: 'New', order: 1, color: '#3B82F6', probability: 10 },
            { name: 'Qualified', order: 2, color: '#10B981', probability: 50 },
          ],
        },
      },
    });

    const userA = await prisma.user.create({
      data: {
        clientId: clientA.id,
        name: 'Client A Admin',
        email: `admin.omni.${Date.now()}@omni.com`,
        passwordHash: clientPassHash,
        role: UserRole.CLIENT_ADMIN,
        isActive: true,
      },
    });

    const clientALogin = await request(app.getHttpServer())
      .post('/api/client/auth/login')
      .send({ email: userA.email, password: 'ClientAdmin@123' });
    clientAToken = clientALogin.body.accessToken;

    // 3. Setup Client B
    clientB = await prisma.client.create({
      data: {
        name: 'Isolated Tech B',
        primaryContactEmail: 'tech.b@isolated.com',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.STARTER,
        leadStages: {
          create: [{ name: 'New', order: 1, color: '#3B82F6', probability: 10 }],
        },
      },
    });

    const userB = await prisma.user.create({
      data: {
        clientId: clientB.id,
        name: 'Client B Admin',
        email: `admin.iso.${Date.now()}@isolated.com`,
        passwordHash: clientPassHash,
        role: UserRole.CLIENT_ADMIN,
        isActive: true,
      },
    });

    const clientBLogin = await request(app.getHttpServer())
      .post('/api/client/auth/login')
      .send({ email: userB.email, password: 'ClientAdmin@123' });
    clientBToken = clientBLogin.body.accessToken;
  });

  afterAll(async () => {
    if (clientA?.id) {
      await prisma.lead.deleteMany({ where: { clientId: clientA.id } });
      await prisma.campaign.deleteMany({ where: { clientId: clientA.id } });
      await prisma.integration.deleteMany({ where: { clientId: clientA.id } });
      await prisma.webhookLog.deleteMany({ where: { clientId: clientA.id } });
      await prisma.leadStage.deleteMany({ where: { clientId: clientA.id } });
      await prisma.user.deleteMany({ where: { clientId: clientA.id } });
      await prisma.client.delete({ where: { id: clientA.id } }).catch(() => {});
    }
    if (clientB?.id) {
      await prisma.lead.deleteMany({ where: { clientId: clientB.id } });
      await prisma.campaign.deleteMany({ where: { clientId: clientB.id } });
      await prisma.integration.deleteMany({ where: { clientId: clientB.id } });
      await prisma.webhookLog.deleteMany({ where: { clientId: clientB.id } });
      await prisma.leadStage.deleteMany({ where: { clientId: clientB.id } });
      await prisma.user.deleteMany({ where: { clientId: clientB.id } });
      await prisma.client.delete({ where: { id: clientB.id } }).catch(() => {});
    }
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. ADMIN CONFIGURATION & CREDENTIAL ENCRYPTION/MASKING
  // ---------------------------------------------------------------------------

  it('should allow platform admin to configure Meta integration credentials and mask sensitive fields', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appId: '123456789012345',
        appSecret: 'super_secret_meta_app_secret_9999',
        redirectUri: 'https://crm.dashmindsiq.com/api/integrations/meta/callback',
        webhookVerifyToken: 'meta_verify_secret_token_123',
        apiVersion: 'v19.0',
        pageId: '109283746501928',
        pageName: 'OmniChannel Real Estate Page',
        leadFormId: '772819203948571',
        leadFormName: 'Q4 Luxury Villa Inquiries',
      });

    expect(res.status).toBe(201);
    expect(res.body.channel).toBe('META');
    expect(res.body.status).toBe(IntegrationStatus.DISCONNECTED);

    // CRITICAL SECURITY ASSERTION: Secret must NEVER be returned in plaintext
    expect(res.body.credentials.appSecret).toBeDefined();
    expect(res.body.credentials.appSecret).not.toBe('super_secret_meta_app_secret_9999');
    expect(res.body.credentials.appSecret).toContain('••••••••');
    expect(res.body.credentials.webhookVerifyToken).toContain('••••••••');

    // Metadata is preserved
    expect(res.body.metadata.pageName).toBe('OmniChannel Real Estate Page');
    expect(res.body.metadata.pageId).toBe('109283746501928');

    // Verify database record has ciphertext (AES-256-GCM format iv:tag:cipher)
    const dbRecord = await prisma.integration.findFirst({
      where: { clientId: clientA.id, channel: ChannelType.META },
    });
    const creds = dbRecord?.credentials as Record<string, any>;
    expect(creds.appSecret).toContain(':'); // Contains IV and tag delimiter
    expect(creds.appSecret).not.toBe('super_secret_meta_app_secret_9999');
  });

  it('should reject invalid email entered as Meta App ID', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appId: 'developer@meta.com',
        appSecret: 'some_secret_123',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Enter a valid numeric Meta App ID.');
  });

  it('should reject non-numeric Meta App ID', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appId: 'facebook_app_abc',
        appSecret: 'some_secret_123',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Enter a valid numeric Meta App ID.');
  });

  it('should reject non-numeric Connected Page ID or Lead Form ID', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appId: '123456789012345',
        appSecret: 'some_secret_123',
        pageId: 'page_invalid_alpha',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Connected Page ID must be numeric.');
  });

  it('should preserve existing secret when editing without changing it (masked value submitted)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appId: '123456789012345',
        appSecret: '••••••••9999',
        pageName: 'Updated Omni Page Name',
      });

    expect(res.status).toBe(201);
    expect(res.body.metadata.pageName).toBe('Updated Omni Page Name');
    expect(res.body.credentials.appSecret).toContain('••••••••');

    // Verify database record still decrypts to the original secret
    const dbRecord = await prisma.integration.findFirst({
      where: { clientId: clientA.id, channel: ChannelType.META },
    });
    const creds = dbRecord?.credentials as Record<string, any>;
    const encryption = app.get(IntegrationEncryptionService);
    const decrypted = encryption.decrypt(creds.appSecret);
    expect(decrypted).toBe('super_secret_meta_app_secret_9999');
  });

  it('should reject configuration for non-existent client (cross-tenant safety)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/clients/00000000-0000-0000-0000-000000000000/integrations/META/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appId: '123456789012345',
        appSecret: 'secret_123',
      });

    expect(res.status).toBe(404);
  });

  it('should allow platform admin to configure Google Ads and LinkedIn integrations', async () => {
    // Google Ads
    const googleRes = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/GOOGLE/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId: '998877-apps.googleusercontent.com',
        clientSecret: 'google_oauth_secret_abc123',
        developerToken: 'dev_token_xyz_987654',
        customerId: '123-456-7890',
        accountName: 'Omni Agency Google Ads Production',
      });

    expect(googleRes.status).toBe(201);
    expect(googleRes.body.credentials.clientSecret).toContain('••••••••');
    expect(googleRes.body.credentials.developerToken).toContain('••••••••');
    expect(googleRes.body.metadata.accountName).toBe('Omni Agency Google Ads Production');

    // LinkedIn
    const liRes = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/LINKEDIN/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId: 'linkedin_client_id_5544',
        clientSecret: 'linkedin_secret_key_8899',
        organizationId: 'urn:li:organization:10029384',
        organizationName: 'Omni Ventures LinkedIn',
      });

    expect(liRes.status).toBe(201);
    expect(liRes.body.credentials.clientSecret).toContain('••••••••');
  });

  it('should prevent client users from updating integration credentials', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/config`)
      .set('Authorization', `Bearer ${clientAToken}`) // Client Admin token instead of Superadmin
      .send({
        appId: 'hacker_app',
        appSecret: 'hacker_secret',
      });

    expect(res.status).toBe(403);
  });

  it('should allow testing configuration parameters', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/test`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Meta credentials verified');
  });

  // ---------------------------------------------------------------------------
  // 2. OAUTH FLOW (URL GENERATION & SECURE STATE VALIDATION)
  // ---------------------------------------------------------------------------

  let oauthStateToken: string;

  it('should generate an OAuth authorization URL with a secure signed state parameter', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/connect`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.authUrl).toBeDefined();
    expect(res.body.authUrl).toContain('facebook.com');
    expect(res.body.authUrl).toContain('state=');

    // Extract state parameter
    const url = new URL(res.body.authUrl);
    oauthStateToken = url.searchParams.get('state')!;
    expect(oauthStateToken).toBeDefined();
  });

  it('should reject OAuth callback if state parameter is tampered with', async () => {
    const tamperedState = `${oauthStateToken}tampered`;
    const res = await request(app.getHttpServer())
      .get(`/api/integrations/meta/callback?code=mock_code_123&state=${tamperedState}`);

    expect(res.status).toBe(403);
  });

  it('should successfully complete OAuth callback, store encrypted tokens, and set status to CONNECTED', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/integrations/meta/callback?code=mock_code_123&state=${oauthStateToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.clientId).toBe(clientA.id);
    expect(res.body.channel).toBe('META');
    expect(res.body.availableSources.pages.length).toBeGreaterThanOrEqual(1);

    // Verify integration status in DB is now CONNECTED
    const updated = await prisma.integration.findFirst({
      where: { clientId: clientA.id, channel: ChannelType.META },
    });
    expect(updated?.status).toBe(IntegrationStatus.CONNECTED);
    expect(updated?.lastSyncedAt).toBeDefined();
  });

  it('should allow admin to disconnect integration', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/disconnect`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(IntegrationStatus.DISCONNECTED);

    // Re-connect for lead ingestion tests
    await prisma.integration.updateMany({
      where: { clientId: clientA.id, channel: ChannelType.META },
      data: { status: IntegrationStatus.CONNECTED },
    });
    await prisma.integration.updateMany({
      where: { clientId: clientA.id, channel: ChannelType.GOOGLE },
      data: { status: IntegrationStatus.CONNECTED },
    });
    await prisma.integration.updateMany({
      where: { clientId: clientA.id, channel: ChannelType.LINKEDIN },
      data: { status: IntegrationStatus.CONNECTED },
    });
  });

  // ---------------------------------------------------------------------------
  // 3. WEBHOOK VERIFICATION & INTAKE (META, GOOGLE, LINKEDIN)
  // ---------------------------------------------------------------------------

  it('should respond to Meta webhook verification challenge (GET /api/webhooks/meta)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/webhooks/meta')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'meta_verify_secret_token_123',
        'hub.challenge': 'challenge_code_987654321',
      });

    expect(res.status).toBe(200);
    expect(res.text).toBe('challenge_code_987654321');
  });

  it('should receive Meta Lead Ad webhook, auto-create Campaign, and ingest into LeadIngestionService', async () => {
    const metaWebhookPayload = {
      object: 'page',
      entry: [
        {
          id: '109283746501928', // Matches Client A Meta pageId
          time: 1718291029,
          changes: [
            {
              field: 'leadgen',
              value: {
                ad_id: 'ad_2910293847',
                form_id: '772819203948571',
                leadgen_id: 'meta_leadgen_event_001',
                page_id: '109283746501928',
                campaign_id: 'camp_meta_summer_2026',
                campaign_name: 'Meta Summer Villa Sale',
                field_data: [
                  { name: 'first_name', values: ['Aarav'] },
                  { name: 'last_name', values: ['Singhania'] },
                  { name: 'email', values: ['aarav.singhania@villas.com'] },
                  { name: 'phone_number', values: ['+91 9988771122'] },
                  { name: 'company_name', values: ['Singhania Real Estate'] },
                ],
              },
            },
          ],
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/meta')
      .send(metaWebhookPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.leadId).toBeDefined();

    // Verify lead was created in Client A CRM
    const lead = await prisma.lead.findUnique({
      where: { id: res.body.leadId },
      include: { campaign: true, stage: true },
    });

    expect(lead).toBeDefined();
    expect(lead?.clientId).toBe(clientA.id);
    expect(lead?.firstName).toBe('Aarav');
    expect(lead?.source).toBe(ChannelType.META);
    expect(lead?.utmSource).toBe('facebook');
    expect(lead?.utmMedium).toBe('paid_social');

    // Verify Campaign was auto-created and attached
    expect(lead?.campaign).toBeDefined();
    expect(lead?.campaign?.name).toBe('Meta Summer Villa Sale');
    expect(lead?.campaign?.platformCampaignId).toBe('camp_meta_summer_2026');

    // Verify WebhookLog was recorded
    const log = await prisma.webhookLog.findFirst({
      where: { clientId: clientA.id, channel: ChannelType.META, status: 'PROCESSED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
  });

  it('should enforce idempotency and not create a duplicate lead if the same webhook event is redelivered', async () => {
    const duplicateMetaPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                page_id: '109283746501928',
                leadgen_id: 'meta_leadgen_event_001', // Exact same event ID
                field_data: [
                  { name: 'first_name', values: ['Aarav'] },
                  { name: 'email', values: ['aarav.singhania@villas.com'] },
                ],
              },
            },
          ],
        },
      ],
    };

    const countBefore = await prisma.lead.count({ where: { clientId: clientA.id } });

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/meta')
      .send(duplicateMetaPayload);

    expect(res.status).toBe(200);
    expect(res.body.isDuplicate).toBe(true);

    const countAfter = await prisma.lead.count({ where: { clientId: clientA.id } });
    expect(countAfter).toBe(countBefore); // No new lead created
  });

  it('should receive Google Ads lead form webhook and ingest lead with proper attribution', async () => {
    const googleWebhookPayload = {
      customer_id: '123-456-7890', // Matches Client A Google customerId
      campaign_id: 'google_search_pmax_101',
      campaign_name: 'PMax Search Leads Q4',
      gclid: 'gclid_test_unique_click_99988',
      lead_id: 'google_lead_event_002',
      user_column_data: [
        { column_id: 'FIRST_NAME', string_value: 'Priyanka' },
        { column_id: 'LAST_NAME', string_value: 'Nair' },
        { column_id: 'EMAIL', string_value: 'priyanka.nair@digitaltech.in' },
        { column_id: 'PHONE_NUMBER', string_value: '+91 9776655443' },
        { column_id: 'COMPANY_NAME', string_value: 'Digital Tech Ltd' },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/google')
      .send(googleWebhookPayload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});

    const lead = await prisma.lead.findFirst({
      where: { clientId: clientA.id, email: 'priyanka.nair@digitaltech.in' },
    });

    expect(lead?.firstName).toBe('Priyanka');
    expect(lead?.source).toBe(ChannelType.GOOGLE);
    expect(lead?.utmSource).toBe('google');
    expect(lead?.clientId).toBe(clientA.id);
  });

  it('should receive Google Ads "Send test data" webhook without customer_id and resolve via google_key', async () => {
    // Configure googleKey on Client A's Google integration
    const googleInt = await prisma.integration.findFirst({
      where: { clientId: clientA.id, channel: ChannelType.GOOGLE },
    });
    await prisma.integration.update({
      where: { id: googleInt!.id },
      data: {
        metadata: {
          ...((googleInt?.metadata as Record<string, any>) || {}),
          googleKey: 'google_key_test_client_a',
          formId: '2',
        },
      },
    });

    const googleTestPayload = {
      lead_id: 'test_google_lead_e2e_001',
      user_column_data: [
        { column_id: 'FIRST_NAME', string_value: 'Rohan' },
        { column_id: 'LAST_NAME', string_value: 'Sharma' },
        { column_id: 'EMAIL', string_value: 'rohan.sharma@domain.in' },
        { column_id: 'PHONE_NUMBER', string_value: '+91 9888877777' },
      ],
      api_version: '1.0',
      form_id: 2,
      campaign_id: 24341191164,
      google_key: 'google_key_test_client_a',
      is_test: true,
      gcl_id: 'test_gcl_id_554433',
      adgroup_id: 20000000000,
      creative_id: 30000000000,
    };

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/google')
      .send(googleTestPayload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});

    const lead = await prisma.lead.findFirst({
      where: { clientId: clientA.id, email: 'rohan.sharma@domain.in' },
    });

    expect(lead?.firstName).toBe('Rohan');
    expect(lead?.lastName).toBe('Sharma');
    expect(lead?.email).toBe('rohan.sharma@domain.in');
    expect(lead?.source).toBe(ChannelType.GOOGLE);
    expect(lead?.utmSource).toBe('google');
    expect(lead?.clientId).toBe(clientA.id);
    expect((lead?.customFields as any)?.gclid).toBe('test_gcl_id_554433');
    expect((lead?.customFields as any)?.googleKey).toBe('google_key_test_client_a');
    expect((lead?.customFields as any)?.isTest).toBe(true);
    expect((lead?.customFields as any)?.googleTestLead).toBe(true);
    expect((lead?.customFields as any)?.originalLeadId).toBe('test_google_lead_e2e_001');
  });

  it('should allow repeated Google Ads "Send test data" clicks with identical lead_id to create new test rows in CRM', async () => {
    const repeatedTestPayload = {
      lead_id: 'reused_google_test_lead_id_xyz999',
      user_column_data: [
        { column_id: 'FIRST_NAME', string_value: 'TestUser' },
        { column_id: 'LAST_NAME', string_value: 'Repeat' },
        { column_id: 'EMAIL', string_value: 'repeat.test@domain.in' },
        { column_id: 'PHONE_NUMBER', string_value: '+91 9771122334' },
      ],
      api_version: '1.0',
      form_id: 2,
      campaign_id: 24341191164,
      google_key: 'google_key_test_client_a',
      is_test: true,
      gcl_id: 'gcl_repeat_123',
    };

    // First click on "Send test data"
    const res1 = await request(app.getHttpServer())
      .post('/api/webhooks/google')
      .send(repeatedTestPayload);

    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({});

    // Second click on "Send test data" with the exact same lead_id, email, and phone
    const res2 = await request(app.getHttpServer())
      .post('/api/webhooks/google')
      .send(repeatedTestPayload);

    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({});

    // Both test leads should be created in the database and visible in CRM
    const leads = await prisma.lead.findMany({
      where: { clientId: clientA.id, email: 'repeat.test@domain.in' },
      orderBy: { createdAt: 'asc' },
    });

    expect(leads.length).toBe(2);

    // First lead is clean/unique
    expect(leads[0].isDuplicate).toBe(false);
    expect((leads[0].customFields as any)?.isTest).toBe(true);
    expect((leads[0].customFields as any)?.originalLeadId).toBe('reused_google_test_lead_id_xyz999');

    // Second lead receives the Duplicate badge/flag because contact info matches
    expect(leads[1].isDuplicate).toBe(true);
    expect(leads[1].duplicateOfId).toBe(leads[0].id);
    expect((leads[1].customFields as any)?.isTest).toBe(true);
    expect((leads[1].customFields as any)?.originalLeadId).toBe('reused_google_test_lead_id_xyz999');
  });

  it('should preserve strict webhook idempotency for production Google Ads leads (is_test: false)', async () => {
    const prodPayload = {
      customer_id: '123-456-7890',
      lead_id: 'production_google_lead_id_unique_888',
      user_column_data: [
        { column_id: 'FIRST_NAME', string_value: 'RealBuyer' },
        { column_id: 'EMAIL', string_value: 'real.buyer@domain.in' },
        { column_id: 'PHONE_NUMBER', string_value: '+91 9112233445' },
      ],
      campaign_id: 'google_prod_campaign_101',
      is_test: false,
    };

    // First delivery of real Google lead
    const res1 = await request(app.getHttpServer())
      .post('/api/webhooks/google')
      .send(prodPayload);

    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({});

    // Re-delivery of the exact same real Google lead (e.g. network retry)
    const res2 = await request(app.getHttpServer())
      .post('/api/webhooks/google')
      .send(prodPayload);

    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({});

    // Exactly 1 lead should exist (idempotency prevented duplication)
    const leads = await prisma.lead.findMany({
      where: { clientId: clientA.id, email: 'real.buyer@domain.in' },
    });
    expect(leads.length).toBe(1);

    // Webhook log should record IGNORED_DUPLICATE for the second delivery
    const duplicateLog = await prisma.webhookLog.findFirst({
      where: {
        channel: ChannelType.GOOGLE,
        status: 'IGNORED_DUPLICATE',
        payload: { path: ['lead_id'], equals: 'production_google_lead_id_unique_888' },
      },
    });
    expect(duplicateLog).toBeDefined();
  });

  it('should reject Google Ads webhook when multiple Google integrations exist and none of the deterministic identifiers match', async () => {
    // Both Client A and Supra are CONNECTED. Send payload with unknown key and no customer_id
    const ambiguousPayload = {
      lead_id: 'ambiguous_google_lead_999',
      user_column_data: [
        { column_id: 'FIRST_NAME', string_value: 'Unknown' },
        { column_id: 'EMAIL', string_value: 'unknown@example.com' },
      ],
      google_key: 'unmapped_random_google_key_123',
    };

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/google')
      .send(ambiguousPayload);

    expect(res.status).toBe(400);
  });

  it('should receive LinkedIn Lead Gen Form webhook and ingest lead with proper attribution', async () => {
    const linkedinWebhookPayload = {
      organization_id: 'urn:li:organization:10029384', // Matches Client A LinkedIn org
      campaign_id: 'li_b2b_exec_summit',
      campaign_name: 'Executive Tech Summit 2026',
      lead_id: 'li_lead_event_003',
      form_id: 'urn:li:leadGenForm:771829',
      answers: [
        { questionId: 'firstName', value: 'Vikram' },
        { questionId: 'lastName', value: 'Mehta' },
        { questionId: 'email', value: 'vikram.mehta@enterprise.com' },
        { questionId: 'phone_number', value: '+91 9112233445' },
        { questionId: 'company_name', value: 'Mehta Enterprises' },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/linkedin')
      .send(linkedinWebhookPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const lead = await prisma.lead.findUnique({
      where: { id: res.body.leadId },
    });

    expect(lead?.firstName).toBe('Vikram');
    expect(lead?.source).toBe(ChannelType.LINKEDIN);
    expect(lead?.utmSource).toBe('linkedin');
    expect(lead?.clientId).toBe(clientA.id);
  });

  // ---------------------------------------------------------------------------
  // 4. TENANT ISOLATION
  // ---------------------------------------------------------------------------

  it('should enforce strict tenant isolation so Client B cannot see Client A external leads', async () => {
    // Client A queries leads
    const resA = await request(app.getHttpServer())
      .get('/api/client/leads')
      .set('Authorization', `Bearer ${clientAToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.length).toBeGreaterThanOrEqual(3); // Aarav, Priyanka, Vikram

    // Client B queries leads
    const resB = await request(app.getHttpServer())
      .get('/api/client/leads')
      .set('Authorization', `Bearer ${clientBToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data.length).toBe(0); // Zero leads for Client B
  });
});
