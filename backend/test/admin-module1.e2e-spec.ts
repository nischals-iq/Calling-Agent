import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Module 1: Admin & Client Management (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let createdClientId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Admin Authentication', () => {
    it('should reject login with invalid credentials (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ email: 'admin@dashmindsiq.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should login successfully with valid admin credentials and return JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ email: 'admin@dashmindsiq.com', password: 'Admin@123456' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toHaveProperty('email', 'admin@dashmindsiq.com');
      expect(res.body.user.role).toBe('PLATFORM_ADMIN');
      adminToken = res.body.accessToken;
    });

    it('should block unauthorized access to protected routes without token (401)', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/dashboard/stats');
      expect(res.status).toBe(401);
    });

    it('should get current admin profile with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@dashmindsiq.com');
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('2. Admin Dashboard & Plans', () => {
    it('should return system dashboard stats and system health', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('overview');
      expect(res.body).toHaveProperty('systemHealth');
      expect(res.body.systemHealth.status).toBe('OPTIMAL');
      expect(res.body.overview.totalClients).toBeGreaterThanOrEqual(1);
    });

    it('should list all subscription plans and limits', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(4); // FREE, STARTER, PRO, ENTERPRISE
    });
  });

  describe('3. Client Management & Onboarding', () => {
    it('should list clients with pagination and filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/clients?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should create a new tenant client with onboarding details', async () => {
      const uniqueSuffix = Date.now();
      const newClientPayload = {
        name: `Test Tenant Logistics ${uniqueSuffix}`,
        businessCategory: 'Logistics & Supply Chain',
        primaryContactName: 'Vikram Singh',
        primaryContactEmail: `vikram_${uniqueSuffix}@logistics.com`,
        primaryContactPhone: '+91 9988776655',
        companyAddress: 'Plot 12, Industrial Area, Mumbai',
        country: 'India',
        timezone: 'Asia/Kolkata',
        status: 'ACTIVE',
        plan: 'STARTER',
        settings: {
          leadSources: ['META', 'GOOGLE', 'WEBSITE'],
          notificationRules: {
            emailOnNewLead: true,
            whatsappOnNewLead: false,
            dailySummaryEmail: true,
          },
        },
        initialAdmin: {
          name: 'Vikram Singh',
          email: `vikram_${uniqueSuffix}@logistics.com`,
          password: 'ClientPassword123!',
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/admin/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newClientPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('client');
      expect(res.body.client.name).toBe(newClientPayload.name);
      expect(res.body.client.leadStages.length).toBe(8); // Default seeded stages
      createdClientId = res.body.client.id;
    });

    it('should retrieve client details with profile, usage, and audit activities', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/clients/${createdClientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.client.id).toBe(createdClientId);
      expect(res.body).toHaveProperty('usage');
      expect(res.body).toHaveProperty('recentActivity');
    });

    it('should deactivate and reactivate a client', async () => {
      const deactivateRes = await request(app.getHttpServer())
        .patch(`/api/admin/clients/${createdClientId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.status).toBe('INACTIVE');

      const activateRes = await request(app.getHttpServer())
        .patch(`/api/admin/clients/${createdClientId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.status).toBe('ACTIVE');
    });

    it('should update client subscription plan', async () => {
      const planRes = await request(app.getHttpServer())
        .patch(`/api/admin/clients/${createdClientId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'PRO' });

      expect(planRes.status).toBe(200);
      expect(planRes.body.plan).toBe('PRO');
    });
  });

  describe('4. Audit Logs', () => {
    it('should fetch audit logs verifying recorded admin actions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Check that client creation or login action was logged
      const actions = res.body.data.map((l: any) => l.action);
      expect(actions).toContain('ADMIN_LOGIN_SUCCESS');
    });
  });
});
