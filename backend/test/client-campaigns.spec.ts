import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

describe('Client Campaigns API & Tenant Isolation (E2E Test)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const supraClientId = 'ece818d0-950c-480a-8873-00484c8f7ba9'; // Supra
  const otherClientId = '45ac13b1-ca29-48ee-b3e9-110a134d2bbe'; // GT3

  const supraUserId = '84e393a7-1821-4ee9-85c7-7f4ad6746f26'; // don@gmail.com (Supra)
  const otherUserId = '8e70d703-b411-4c0e-92ec-8e17be1b2729'; // john@gmail.com (GT3)

  let supraToken: string;
  let otherClientToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    // Create JWT tokens using valid users for each tenant
    supraToken = jwt.sign({
      sub: supraUserId,
      email: 'don@gmail.com',
      role: UserRole.CLIENT_ADMIN,
      clientId: supraClientId,
    });

    otherClientToken = jwt.sign({
      sub: otherUserId,
      email: 'john@gmail.com',
      role: UserRole.CLIENT_ADMIN,
      clientId: otherClientId,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/client/campaigns');
    expect(res.status).toBe(401);
  });

  it('should return Supra campaigns including the created Meta test campaign', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/client/campaigns')
      .set('Authorization', `Bearer ${supraToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const metaCamp = res.body.find((c: any) => c.platformCampaignId === '120252088348760776');
    expect(metaCamp).toBeDefined();
    expect(metaCamp.name).toBe('FirstCall Meta Test Campaign');
    expect(metaCamp.source).toBe('META');
    expect(metaCamp.status).toBe('PAUSED');
    expect(metaCamp.objective).toBe('OUTCOME_LEADS');
    console.log('VERIFIED_SUPRA_CAMPAIGNS:', res.body);
  });

  it('should enforce strict tenant isolation: other client must NOT see Supra campaigns', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/client/campaigns')
      .set('Authorization', `Bearer ${otherClientToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const leakedCamp = res.body.find((c: any) => c.platformCampaignId === '120252088348760776');
    expect(leakedCamp).toBeUndefined();
  });

  it('should fetch single campaign details by ID for the tenant', async () => {
    // 1. Get campaign ID from list
    const listRes = await request(app.getHttpServer())
      .get('/api/client/campaigns')
      .set('Authorization', `Bearer ${supraToken}`);
    const metaCamp = listRes.body.find((c: any) => c.platformCampaignId === '120252088348760776');
    const campaignId = metaCamp ? metaCamp.id : listRes.body[0].id;

    // 2. Fetch by ID
    const detailRes = await request(app.getHttpServer())
      .get(`/api/client/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${supraToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(campaignId);
    expect(detailRes.body.name).toBe('FirstCall Meta Test Campaign');

    // 3. Other client cannot access this campaign by ID
    const forbiddenRes = await request(app.getHttpServer())
      .get(`/api/client/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${otherClientToken}`);

    expect(forbiddenRes.status).toBe(404);
  });

  it('should reject Ad Set creation if attempted by another tenant (tenant isolation)', async () => {
    // 1. Get campaign ID for Supra
    const listRes = await request(app.getHttpServer())
      .get('/api/client/campaigns')
      .set('Authorization', `Bearer ${supraToken}`);
    const metaCamp = listRes.body.find((c: any) => c.platformCampaignId === '120252088348760776');

    // 2. Other client attempts to create Ad Set on Supra's campaign
    const res = await request(app.getHttpServer())
      .post(`/api/client/campaigns/${metaCamp.id}/adset`)
      .set('Authorization', `Bearer ${otherClientToken}`)
      .send({
        name: 'Unauthorized Ad Set',
        dailyBudget: 100,
      });

    expect(res.status).toBe(404);
  });

  it('should create ONE real Meta Ad Set under the existing Meta campaign and verify via read-back', async () => {
    // 1. Find the existing FirstCall Meta Test Campaign
    const listRes = await request(app.getHttpServer())
      .get('/api/client/campaigns')
      .set('Authorization', `Bearer ${supraToken}`);
    const metaCamp = listRes.body.find((c: any) => c.platformCampaignId === '120252088348760776');
    expect(metaCamp).toBeDefined();

    // 2. Call the Ad Set creation endpoint
    const res = await request(app.getHttpServer())
      .post(`/api/client/campaigns/${metaCamp.id}/adset`)
      .set('Authorization', `Bearer ${supraToken}`)
      .send({
        name: 'FirstCall Meta Test Ad Set',
        dailyBudget: 100, // ₹100 INR
        countries: ['IN'],
        ageMin: 18,
        ageMax: 65,
        gender: 'ALL',
      });

    console.log('ADSET_CREATION_RESULT:', JSON.stringify(res.body, null, 2));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.adSetId).toBeDefined();
    expect(res.body.status).toBe('PAUSED');
    expect(res.body.verification.verified).toBe(true);
    expect(res.body.verification.readBack.id).toBe(res.body.adSetId);
  }, 45000);

  // -------------------------------------------------------------
  // STEP 1: UNIFIED INTERNAL / MASTER CAMPAIGN TESTS
  // -------------------------------------------------------------
  describe('Internal / Master Campaigns (Step 1)', () => {
    let createdMetaDraftId: string;
    let createdBothDraftId: string;

    it('should create a META-only internal campaign draft', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/internal-campaigns')
        .set('Authorization', `Bearer ${supraToken}`)
        .send({
          name: 'Supra Spring Meta Leads Draft',
          objective: 'LEADS',
          totalBudget: 15000,
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          landingPageUrl: 'https://supra.example.com/demo',
          locations: ['IN'],
          minAge: 21,
          maxAge: 55,
          gender: 'ALL',
          headline: 'Transform Your Sales Pipeline with Supra',
          primaryText: 'AI-assisted lead intake and CRM synchronization.',
          description: 'Book your free demo today and experience seamless lead processing.',
          callToAction: 'SIGN_UP',
          useMeta: true,
          useGoogle: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.clientId).toBe(supraClientId);
      expect(res.body.name).toBe('Supra Spring Meta Leads Draft');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.useMeta).toBe(true);
      expect(res.body.useGoogle).toBe(false);
      expect(res.body.totalBudget).toBe(15000);
      expect(res.body.objective).toBe('LEADS');
      createdMetaDraftId = res.body.id;
    });

    it('should create a GOOGLE-only internal campaign draft', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/internal-campaigns')
        .set('Authorization', `Bearer ${supraToken}`)
        .send({
          name: 'Supra Google Search Master Draft',
          objective: 'LEADS',
          totalBudget: 25000,
          useMeta: false,
          useGoogle: true,
          locations: ['IN', 'US'],
          headline: 'Enterprise CRM Automation',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.clientId).toBe(supraClientId);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.useMeta).toBe(false);
      expect(res.body.useGoogle).toBe(true);
      expect(res.body.totalBudget).toBe(25000);
    });

    it('should create a BOTH (Meta + Google) internal campaign draft', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/internal-campaigns')
        .set('Authorization', `Bearer ${supraToken}`)
        .send({
          name: 'Supra Omnichannel Q4 Master Campaign',
          objective: 'LEADS',
          totalBudget: 50000,
          useMeta: true,
          useGoogle: true,
          headline: 'Omnichannel B2B Growth Platform',
          callToAction: 'LEARN_MORE',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.useMeta).toBe(true);
      expect(res.body.useGoogle).toBe(true);
      createdBothDraftId = res.body.id;
    });

    it('should reject internal campaign creation when neither platform is selected', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/internal-campaigns')
        .set('Authorization', `Bearer ${supraToken}`)
        .send({
          name: 'Invalid Empty Platform Campaign',
          objective: 'LEADS',
          useMeta: false,
          useGoogle: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('At least one platform');
    });

    it('should reject internal campaign creation when end date is before start date', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/internal-campaigns')
        .set('Authorization', `Bearer ${supraToken}`)
        .send({
          name: 'Invalid Dates Campaign',
          objective: 'LEADS',
          startDate: '2026-12-01',
          endDate: '2026-11-01',
          useMeta: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('End date must be on or after start date');
    });

    it('should list only Supra internal campaigns for Supra client', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/internal-campaigns')
        .set('Authorization', `Bearer ${supraToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      expect(res.body.every((c: any) => c.clientId === supraClientId)).toBe(true);
    });

    it('should enforce tenant isolation: other client cannot access Supra internal campaign by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/client/internal-campaigns/${createdMetaDraftId}`)
        .set('Authorization', `Bearer ${otherClientToken}`);

      expect(res.status).toBe(404);
    });

    it('should enforce tenant isolation: other client cannot update Supra internal campaign by ID', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/client/internal-campaigns/${createdMetaDraftId}`)
        .set('Authorization', `Bearer ${otherClientToken}`)
        .send({
          name: 'Malicious Update Attempt',
        });

      expect(res.status).toBe(404);
    });

    it('should allow Supra to edit an internal campaign while in DRAFT status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/client/internal-campaigns/${createdBothDraftId}`)
        .set('Authorization', `Bearer ${supraToken}`)
        .send({
          name: 'Supra Omnichannel Q4 Master Campaign (Updated)',
          totalBudget: 60000,
          headline: 'Next-Gen B2B Lead Conversion Engine',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Supra Omnichannel Q4 Master Campaign (Updated)');
      expect(res.body.totalBudget).toBe(60000);
      expect(res.body.headline).toBe('Next-Gen B2B Lead Conversion Engine');
      expect(res.body.status).toBe('DRAFT');
    });

    // -------------------------------------------------------------
    // STEP 2, 3 & 4: PUBLISHING TO META, GOOGLE, AND BOTH
    // -------------------------------------------------------------
    it('should reject publish if attempted by another tenant (tenant isolation)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/client/internal-campaigns/${createdMetaDraftId}/publish`)
        .set('Authorization', `Bearer ${otherClientToken}`)
        .send({ platform: 'META' });

      expect(res.status).toBe(404);
    });

    it('should publish a Meta master campaign through the complete pipeline (Campaign -> Ad Set -> Creative -> Ad)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/client/internal-campaigns/${createdMetaDraftId}/publish`)
        .set('Authorization', `Bearer ${supraToken}`)
        .send({ platform: 'META' });

      console.log('META_PUBLISH_RESULT:', JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.results.meta).toBeDefined();
      expect(res.body.results.meta.platform).toBe('META');
      expect(res.body.results.meta.platformCampaignId).toBeDefined();
      expect(res.body.results.meta.adSetId).toBeDefined();
      expect(res.body.results.meta.creativeId).toBeDefined();
      expect(res.body.results.meta.adId).toBeDefined();
      expect(res.body.results.meta.status).toBe('PAUSED');
      expect(res.body.masterCampaign.status).toBe('PUBLISHED');
      expect(res.body.masterCampaign.platformCampaigns.length).toBeGreaterThanOrEqual(1);
    }, 45000);

    it('should publish a Google master campaign through the complete pipeline (Budget -> Campaign -> Ad Group -> Keywords -> Ad)', async () => {
      // 1. Create a clean Google master campaign draft
      const draftRes = await request(app.getHttpServer())
        .post('/api/client/internal-campaigns')
        .set('Authorization', `Bearer ${supraToken}`)
        .send({
          name: 'Supra Google Search Direct Test',
          objective: 'LEADS',
          totalBudget: 15000,
          useMeta: false,
          useGoogle: true,
          locations: ['IN'],
          headline: 'Next-Gen B2B CRM',
          primaryText: 'Automate sales calls and inbound conversion with AI.',
        });

      expect(draftRes.status).toBe(201);
      const googleDraftId = draftRes.body.id;

      // 2. Publish to Google
      const pubRes = await request(app.getHttpServer())
        .post(`/api/client/internal-campaigns/${googleDraftId}/publish`)
        .set('Authorization', `Bearer ${supraToken}`)
        .send({ platform: 'GOOGLE' });

      console.log('GOOGLE_PUBLISH_RESULT:', JSON.stringify(pubRes.body, null, 2));

      expect(pubRes.status).toBe(201);
      expect(pubRes.body.success).toBe(true);
      expect(pubRes.body.results.google).toBeDefined();
      expect(pubRes.body.results.google.platform).toBe('GOOGLE');
      expect(pubRes.body.results.google.budgetId).toBeDefined();
      expect(pubRes.body.results.google.platformCampaignId).toBeDefined();
      expect(pubRes.body.results.google.adGroupId).toBeDefined();
      expect(pubRes.body.results.google.keywordsCount).toBeGreaterThan(0);
      expect(pubRes.body.results.google.adId).toBeDefined();
      expect(pubRes.body.results.google.status).toBe('PAUSED');
      expect(pubRes.body.masterCampaign.status).toBe('PUBLISHED');
    }, 45000);

    it('should publish to BOTH Meta and Google simultaneously from a single master campaign', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/client/internal-campaigns/${createdBothDraftId}/publish`)
        .set('Authorization', `Bearer ${supraToken}`)
        .send({ platform: 'BOTH' });

      console.log('BOTH_PUBLISH_RESULT:', JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.results.meta).toBeDefined();
      expect(res.body.results.meta.platformCampaignId).toBeDefined();
      expect(res.body.results.meta.status).toBe('PAUSED');

      expect(res.body.results.google).toBeDefined();
      expect(res.body.results.google.platformCampaignId).toBeDefined();
      expect(res.body.results.google.status).toBe('PAUSED');

      expect(res.body.masterCampaign.status).toBe('PUBLISHED');
      const sources = res.body.masterCampaign.platformCampaigns.map((p: any) => p.source);
      expect(sources).toContain('META');
      expect(sources).toContain('GOOGLE');
    }, 60000);
  });
});
