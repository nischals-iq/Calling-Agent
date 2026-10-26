import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UserRole, ClientStatus, SubscriptionPlan, ChannelType } from '@prisma/client';
import bcrypt from 'bcryptjs';

describe('Module 3 - Part 1: Lead Capture Foundation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tenantA: any;
  let tenantB: any;
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantAApiKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('ClientAdmin@123', salt);

    // 1. Setup Tenant A
    tenantA = await prisma.client.create({
      data: {
        name: 'Nexus Real Estate A',
        primaryContactEmail: 'owner.a@nexus.com',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.PRO,
        apiKey: 'ca_live_nexus_tenant_a_key_123',
        leadStages: {
          create: [
            { name: 'New', order: 1, color: '#3B82F6', probability: 10 },
            { name: 'Qualified', order: 2, color: '#10B981', probability: 50 },
          ],
        },
      },
    });
    tenantAApiKey = tenantA.apiKey;

    const userA = await prisma.user.create({
      data: {
        clientId: tenantA.id,
        name: 'Admin Tenant A',
        email: `admin.a.${Date.now()}@nexus.com`,
        passwordHash: passHash,
        role: UserRole.CLIENT_ADMIN,
        isActive: true,
      },
    });

    const loginResA = await request(app.getHttpServer())
      .post('/api/client/auth/login')
      .send({ email: userA.email, password: 'ClientAdmin@123' });
    tenantAToken = loginResA.body.accessToken;

    // 2. Setup Tenant B
    tenantB = await prisma.client.create({
      data: {
        name: 'Vortex Tech Tenant B',
        primaryContactEmail: 'owner.b@vortex.com',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.PRO,
        apiKey: 'ca_live_vortex_tenant_b_key_456',
        leadStages: {
          create: [{ name: 'New', order: 1, color: '#3B82F6', probability: 10 }],
        },
      },
    });

    const userB = await prisma.user.create({
      data: {
        clientId: tenantB.id,
        name: 'Admin Tenant B',
        email: `admin.b.${Date.now()}@vortex.com`,
        passwordHash: passHash,
        role: UserRole.CLIENT_ADMIN,
        isActive: true,
      },
    });

    const loginResB = await request(app.getHttpServer())
      .post('/api/client/auth/login')
      .send({ email: userB.email, password: 'ClientAdmin@123' });
    tenantBToken = loginResB.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup test data
    if (tenantA?.id) {
      await prisma.lead.deleteMany({ where: { clientId: tenantA.id } });
      await prisma.leadStage.deleteMany({ where: { clientId: tenantA.id } });
      await prisma.user.deleteMany({ where: { clientId: tenantA.id } });
      await prisma.client.delete({ where: { id: tenantA.id } }).catch(() => {});
    }
    if (tenantB?.id) {
      await prisma.lead.deleteMany({ where: { clientId: tenantB.id } });
      await prisma.leadStage.deleteMany({ where: { clientId: tenantB.id } });
      await prisma.user.deleteMany({ where: { clientId: tenantB.id } });
      await prisma.client.delete({ where: { id: tenantB.id } }).catch(() => {});
    }
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. Manual Lead Entry
  // ---------------------------------------------------------------------------
  it('should create a lead manually with complete attribution and notes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/client/leads/manual')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        firstName: 'Rohan',
        lastName: 'Verma',
        email: 'rohan.verma@example.com',
        mobile: '+91 9876543210',
        company: 'Verma Enterprises',
        source: ChannelType.OTHER,
        campaign: 'Q4 Direct Outreach',
        notes: 'Requested a product demo regarding cloud calling.',
        temperature: 'WARM',
        dealValue: 50000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.lead).toBeDefined();
    expect(res.body.lead.firstName).toBe('Rohan');
    expect(res.body.lead.email).toBe('rohan.verma@example.com');
    expect(res.body.lead.phone).toBe('+919876543210');
    expect(res.body.lead.campaignName).toBe('Q4 Direct Outreach');
    expect(res.body.lead.notes).toBe('Requested a product demo regarding cloud calling.');
    expect(res.body.isDuplicate).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 2. Duplicate Detection (Email and Phone)
  // ---------------------------------------------------------------------------
  it('should detect duplicate lead on matching email and flag it clearly without silent overwrite', async () => {
    const duplicateRes = await request(app.getHttpServer())
      .post('/api/client/leads/manual')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        firstName: 'Rohan',
        lastName: 'Verma (Duplicate)',
        email: 'rohan.verma@example.com', // Duplicate email
        mobile: '+91 9999999999',
        company: 'Verma Enterprises',
        source: ChannelType.WEBSITE,
      });

    expect(duplicateRes.status).toBe(201);
    expect(duplicateRes.body.isDuplicate).toBe(true);
    expect(duplicateRes.body.duplicateReason).toBe('MATCHED_EMAIL');
    expect(duplicateRes.body.duplicateOfId).toBeDefined();

    // Verify original lead duplicateCount was incremented
    const original = await prisma.lead.findFirst({
      where: { id: duplicateRes.body.duplicateOfId },
    });
    expect(original?.duplicateCount).toBeGreaterThanOrEqual(1);
  });

  it('should detect duplicate lead on matching phone number', async () => {
    const duplicatePhoneRes = await request(app.getHttpServer())
      .post('/api/client/leads/manual')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        firstName: 'Someone',
        lastName: 'Else',
        email: 'different.email@example.com',
        mobile: '+91 9876543210', // Matches original Rohan phone
        source: ChannelType.REFERRAL,
      });

    expect(duplicatePhoneRes.status).toBe(201);
    expect(duplicatePhoneRes.body.isDuplicate).toBe(true);
    expect(duplicatePhoneRes.body.duplicateReason).toBe('MATCHED_PHONE');
  });

  // ---------------------------------------------------------------------------
  // 3. Website & Public API Lead Capture
  // ---------------------------------------------------------------------------
  it('should capture a lead via public website form endpoint with full UTM & marketing metadata', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/public/leads/capture')
      .set('x-tenant-key', tenantAApiKey)
      .send({
        firstName: 'Ananya',
        lastName: 'Deshmukh',
        email: 'ananya.deshmukh@techcorp.in',
        phone: '+91 9123456789',
        company: 'TechCorp India',
        source: ChannelType.WEBSITE,
        medium: 'cpc',
        campaignName: 'Summer Sale 2026',
        landingPageUrl: 'https://acme.com/landing/cloud-agent',
        formId: 'hero-banner-form',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'summer_sale_2026',
        utmContent: 'cta_blue_button',
        utmTerm: 'best calling crm',
        message: 'Looking for 25 agent seats.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.lead.firstName).toBe('Ananya');
    expect(res.body.lead.utmCampaign).toBe('summer_sale_2026');
    expect(res.body.lead.landingPageUrl).toBe('https://acme.com/landing/cloud-agent');
    expect(res.body.lead.notes).toBe('Looking for 25 agent seats.');
    expect(res.body.lead.clientId).toBe(tenantA.id);
  });

  it('should reject public website capture if API key is invalid or missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/public/leads/capture')
      .set('x-tenant-key', 'invalid_key_999')
      .send({
        firstName: 'Intruder',
        email: 'intruder@example.com',
      });

    expect(res.status).toBe(401);
  });

  it('should reject malformed payload missing first name', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/public/leads/capture')
      .set('x-tenant-key', tenantAApiKey)
      .send({
        email: 'noname@example.com', // Missing firstName
      });

    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // 4. CSV Import Flow (Preview -> Validation -> Confirm)
  // ---------------------------------------------------------------------------
  it('should preview CSV data with column mapping, validation and duplicate detection', async () => {
    const rawRows = [
      {
        'Full Name': 'Kunal Shah',
        'Email Address': 'kunal@cred.com',
        Phone: '+91 9988776655',
        Org: 'Cred',
      },
      {
        'Full Name': 'Rohan Verma', // Existing duplicate
        'Email Address': 'rohan.verma@example.com',
        Phone: '+91 9876543210',
        Org: 'Verma Enterprises',
      },
      {
        'Full Name': '', // Invalid: missing first name
        'Email Address': 'invalid@example.com',
        Phone: '+91 0000000000',
        Org: 'Bad Row',
      },
    ];

    const mapping = {
      'Full Name': 'firstName',
      'Email Address': 'email',
      Phone: 'phone',
      Org: 'company',
    };

    const res = await request(app.getHttpServer())
      .post('/api/client/leads/import/preview')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({ rawRows, columnMapping: mapping });

    expect(res.status).toBe(201);
    expect(res.body.totalRows).toBe(3);
    expect(res.body.validCount).toBe(2);
    expect(res.body.invalidCount).toBe(1);
    expect(res.body.duplicateCount).toBe(1); // Rohan Verma detected as duplicate
  });

  it('should execute batch CSV import and report accurate success/duplicate summary', async () => {
    const rows = [
      {
        firstName: 'Pooja',
        lastName: 'Hegde',
        email: 'pooja.hegde@films.com',
        phone: '+91 9871122334',
        company: 'Filmworks',
      },
      {
        firstName: 'Deepak',
        lastName: 'Chopra',
        email: 'deepak.chopra@wellness.com',
        phone: '+91 9872233445',
        company: 'Chopra Center',
      },
    ];

    const res = await request(app.getHttpServer())
      .post('/api/client/leads/import/confirm')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        rows,
        defaultSource: ChannelType.CSV_IMPORT,
        defaultCampaign: 'CSV Batch Oct 2026',
        duplicateHandling: 'FLAG',
      });

    expect(res.status).toBe(201);
    expect(res.body.importedCount).toBe(2);
    expect(res.body.errorCount).toBe(0);
    expect(res.body.leads.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 5. Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  it('should enforce strict tenant isolation so Tenant B cannot see Tenant A leads', async () => {
    // Tenant A queries its leads
    const resA = await request(app.getHttpServer())
      .get('/api/client/leads')
      .set('Authorization', `Bearer ${tenantAToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.length).toBeGreaterThanOrEqual(1);

    // Tenant B queries its leads (must NOT see any Tenant A leads)
    const resB = await request(app.getHttpServer())
      .get('/api/client/leads')
      .set('Authorization', `Bearer ${tenantBToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data.length).toBe(0); // Tenant B has 0 leads

    // Tenant B attempting to access a Tenant A lead by ID must receive 404
    const leadAId = resA.body.data[0].id;
    const crossRes = await request(app.getHttpServer())
      .get(`/api/client/leads/${leadAId}`)
      .set('Authorization', `Bearer ${tenantBToken}`);

    expect(crossRes.status).toBe(404);
  });
});
