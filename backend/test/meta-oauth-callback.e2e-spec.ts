import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UserRole, ClientStatus, SubscriptionPlan, ChannelType, IntegrationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { IntegrationsService } from '../src/modules/integrations/integrations.service.js';
import { IntegrationEncryptionService } from '../src/modules/integrations/services/integration-encryption.service.js';

describe('Meta OAuth Callback & Connect Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let integrationsService: IntegrationsService;
  let encryptionService: IntegrationEncryptionService;

  let adminToken: string;
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
    integrationsService = app.get(IntegrationsService);
    encryptionService = app.get(IntegrationEncryptionService);

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('Admin@123456', salt);

    // 1. Setup Platform Superadmin
    await prisma.user.upsert({
      where: { email: 'superadmin.meta@callingagent.com' },
      update: { passwordHash: passHash, isActive: true, role: UserRole.PLATFORM_ADMIN },
      create: {
        name: 'Meta Admin Tester',
        email: 'superadmin.meta@callingagent.com',
        passwordHash: passHash,
        role: UserRole.PLATFORM_ADMIN,
        isActive: true,
      },
    });

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'superadmin.meta@callingagent.com', password: 'Admin@123456' });
    adminToken = adminLoginRes.body.accessToken;

    // 2. Setup Client A
    clientA = await prisma.client.create({
      data: {
        name: 'Meta OAuth Test Client A',
        primaryContactEmail: 'client.a.meta@example.com',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.ENTERPRISE,
      },
    });

    // 3. Setup Client B (for cross-tenant tests)
    clientB = await prisma.client.create({
      data: {
        name: 'Meta OAuth Test Client B',
        primaryContactEmail: 'client.b.meta@example.com',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.PRO,
      },
    });

    // 4. Configure Meta credentials for Client A
    await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientA.id}/integrations/META/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appId: '109283746519283',
        appSecret: 'test_meta_app_secret_abc123',
        webhookVerifyToken: 'verify_token_client_a',
      });

    // 5. Configure Meta credentials for Client B
    await request(app.getHttpServer())
      .post(`/api/admin/clients/${clientB.id}/integrations/META/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appId: '984726154829103',
        appSecret: 'test_meta_app_secret_client_b',
        webhookVerifyToken: 'verify_token_client_b',
      });
  });

  afterAll(async () => {
    if (clientA) {
      await prisma.auditLog.deleteMany({ where: { clientId: clientA.id } });
      await prisma.integration.deleteMany({ where: { clientId: clientA.id } });
      await prisma.client.delete({ where: { id: clientA.id } }).catch(() => {});
    }
    if (clientB) {
      await prisma.auditLog.deleteMany({ where: { clientId: clientB.id } });
      await prisma.integration.deleteMany({ where: { clientId: clientB.id } });
      await prisma.client.delete({ where: { id: clientB.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: 'superadmin.meta@callingagent.com' } });
    await app.close();
  });

  // ===========================================================================
  // 1. CONNECT ENDPOINT & DYNAMIC REDIRECT URI
  // ===========================================================================

  describe('Connect Meta URL Generation', () => {
    it('should generate an authorization URL using the dynamic callback redirect URI', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/admin/clients/${clientA.id}/integrations/META/connect`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.authUrl).toBeDefined();
      expect(res.body.authUrl).toContain('facebook.com');
      expect(res.body.authUrl).toContain('client_id=109283746519283');
      expect(res.body.authUrl).toContain('state=');

      // The redirect URI must point to /api/integrations/meta/callback
      const encodedExpectedRedirect = encodeURIComponent('http://localhost:8000/api/integrations/meta/callback');
      expect(res.body.authUrl).toContain(encodedExpectedRedirect);
    });
  });

  // ===========================================================================
  // 2. STATE VALIDATION & SECURITY REJECTIONS
  // ===========================================================================

  describe('OAuth State Validation & Security Checks', () => {
    it('should reject callback with missing state parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback?code=mock_code_123');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('state are required');
    });

    it('should reject callback with tampered or invalid state signature', async () => {
      const validState = integrationsService.generateOAuthState(clientA.id, ChannelType.META);
      const tamperedState = `${validState}corrupted`;

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?code=mock_code_123&state=${tamperedState}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Invalid OAuth state');
    });

    it('should reject callback when state timestamp has expired (> 30 mins)', async () => {
      // Generate state with timestamp 40 minutes in the past
      const expiredTs = Date.now() - 40 * 60 * 1000;
      const expiredState = integrationsService.generateOAuthState(clientA.id, ChannelType.META, expiredTs);

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?code=mock_code_123&state=${expiredState}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('OAuth state has expired');
    });

    it('should reject callback when state channel does not match META', async () => {
      // State signed for GOOGLE channel but sent to Meta callback
      const googleState = integrationsService.generateOAuthState(clientA.id, ChannelType.GOOGLE);

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?code=mock_code_123&state=${googleState}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('channel mismatch');
    });

    it('should reject cross-tenant tampering attempt', async () => {
      // Attacker attempts to forge Client B's ID inside Client A's state without secret
      const invalidState = Buffer.from(
        JSON.stringify({
          payload: JSON.stringify({ clientId: clientB.id, channel: 'META', ts: Date.now() }),
          signature: 'fake_forged_hmac_signature',
        }),
      ).toString('base64url');

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?code=mock_code_123&state=${invalidState}`);

      expect(res.status).toBe(403);

      // Verify Client B's integration was NOT affected
      const clientBIntegration = await prisma.integration.findFirst({
        where: { clientId: clientB.id, channel: ChannelType.META },
      });
      expect(clientBIntegration?.status).toBe(IntegrationStatus.DISCONNECTED);
    });

    it('should reject callback when authorization code is missing', async () => {
      const validState = integrationsService.generateOAuthState(clientA.id, ChannelType.META);

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?state=${validState}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Authorization code and state are required');
    });
  });

  // ===========================================================================
  // 3. META ERROR HANDLING & AUDIT LOGGING
  // ===========================================================================

  describe('Meta Error Response Handling', () => {
    it('should handle Meta error parameter safely without exposing secrets (API mode)', async () => {
      const validState = integrationsService.generateOAuthState(clientA.id, ChannelType.META);

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?error=access_denied&error_description=Permissions+declined+by+user&state=${validState}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Meta OAuth error');
      expect(res.body.message).toContain('Permissions declined by user');

      // Check Integration row has safe error message
      const updated = await prisma.integration.findFirst({
        where: { clientId: clientA.id, channel: ChannelType.META },
      });
      expect(updated?.errorMessage).toContain('Permissions declined by user');

      // Check Audit Log was recorded
      const auditLog = await prisma.auditLog.findFirst({
        where: { clientId: clientA.id, action: 'INTEGRATION_ERROR' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).toBeDefined();
      expect((auditLog?.details as any)?.error).toBe('access_denied');
    });

    it('should redirect browser to CRM with ?meta=error when Meta returns error', async () => {
      const validState = integrationsService.generateOAuthState(clientA.id, ChannelType.META);

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?error=access_denied&error_description=User+cancelled&state=${validState}`)
        .set('Accept', 'text/html');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(`/admin/clients/${clientA.id}`);
      expect(res.headers.location).toContain('meta=error');
    });
  });

  // ===========================================================================
  // 4. SUCCESSFUL CALLBACK & TOKEN ENCRYPTION
  // ===========================================================================

  describe('Successful OAuth Token Exchange & Storage', () => {
    it('should successfully complete callback, encrypt token before DB save, and update Client A', async () => {
      const validState = integrationsService.generateOAuthState(clientA.id, ChannelType.META);

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?code=mock_meta_auth_code_999&state=${validState}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.clientId).toBe(clientA.id);
      expect(res.body.channel).toBe('META');
      expect(res.body.availableSources.pages.length).toBeGreaterThan(0);

      // Verify database state directly via Prisma
      const integration = await prisma.integration.findFirst({
        where: { clientId: clientA.id, channel: ChannelType.META },
      });

      expect(integration).toBeDefined();
      expect(integration?.status).toBe(IntegrationStatus.CONNECTED);
      expect(integration?.lastSyncedAt).toBeDefined();
      expect(integration?.errorMessage).toBeNull(); // previous error cleared

      // Verify token is encrypted at rest (AES-256-GCM format: iv:tag:ciphertext)
      const creds = integration?.credentials as Record<string, any>;
      expect(creds.accessToken).toBeDefined();
      expect(creds.accessToken).toContain(':');
      expect(creds.accessToken.split(':').length).toBe(3);

      // Verify token can be decrypted properly
      const decryptedToken = encryptionService.decrypt(creds.accessToken);
      expect(decryptedToken).toContain('EAAB_mock_meta_auth_code_999_mock_token_');

      // Verify token metadata
      expect(creds.tokenType).toBe('bearer');
      expect(creds.expiresIn).toBe(5184000);
      expect(creds.tokenExpiresAt).toBeDefined();

      // Verify Client B was NOT touched
      const clientBIntegration = await prisma.integration.findFirst({
        where: { clientId: clientB.id, channel: ChannelType.META },
      });
      expect(clientBIntegration?.status).toBe(IntegrationStatus.DISCONNECTED);

      // Verify audit log for connection was recorded
      const connectLog = await prisma.auditLog.findFirst({
        where: { clientId: clientA.id, action: 'INTEGRATION_CONNECTED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(connectLog).toBeDefined();
      expect((connectLog?.details as any)?.connectedVia).toBe('OAuth Callback');
    });

    it('should redirect browser to CRM client page with ?meta=connected on success', async () => {
      const validState = integrationsService.generateOAuthState(clientA.id, ChannelType.META);

      const res = await request(app.getHttpServer())
        .get(`/api/integrations/meta/callback?code=mock_meta_auth_code_888&state=${validState}`)
        .set('Accept', 'text/html');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(`/admin/clients/${clientA.id}?tab=integrations&meta=connected`);
    });
  });
});
