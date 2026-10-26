import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UserRole, ClientStatus, SubscriptionPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';

describe('Module 2: Client Users & Access Control (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let clientA: any;
  let clientB: any;
  let clientAToken: string;
  let clientBToken: string;
  let salesExecToken: string;
  let createdSalesExecId: string;
  let createdTeamId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);

    // Setup Test Client A (Alpha Corp)
    clientA = await prisma.client.create({
      data: {
        name: 'Alpha Corp Test Tenant',
        businessCategory: 'SaaS Software',
        primaryContactEmail: 'alpha.owner@alphacorp.com',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.PRO,
      },
    });

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('AlphaAdmin@123', salt);

    const clientAUser = await prisma.user.create({
      data: {
        clientId: clientA.id,
        name: 'Alpha Admin',
        email: 'alpha.admin@alphacorp.com',
        passwordHash: passHash,
        role: UserRole.CLIENT_ADMIN,
        isActive: true,
      },
    });

    // Setup Test Client B (Beta Logistics)
    clientB = await prisma.client.create({
      data: {
        name: 'Beta Logistics Test Tenant',
        businessCategory: 'Logistics & Supply',
        primaryContactEmail: 'beta.owner@betalogistics.com',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.STARTER,
      },
    });

    const betaPassHash = await bcrypt.hash('BetaAdmin@123', salt);
    await prisma.user.create({
      data: {
        clientId: clientB.id,
        name: 'Beta Admin',
        email: 'beta.admin@betalogistics.com',
        passwordHash: betaPassHash,
        role: UserRole.CLIENT_ADMIN,
        isActive: true,
      },
    });
  }, 30000);

  afterAll(async () => {
    // Clean up test clients
    if (clientA?.id) {
      await prisma.client.delete({ where: { id: clientA.id } }).catch(() => {});
    }
    if (clientB?.id) {
      await prisma.client.delete({ where: { id: clientB.id } }).catch(() => {});
    }
    await app.close();
  }, 30000);

  describe('1. Client Authentication & Session', () => {
    it('should reject client login with incorrect password (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/auth/login')
        .send({ email: 'alpha.admin@alphacorp.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should login client admin successfully and return JWT with tenant info', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/auth/login')
        .send({ email: 'alpha.admin@alphacorp.com', password: 'AlphaAdmin@123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toHaveProperty('role', 'CLIENT_ADMIN');
      expect(res.body.client).toHaveProperty('id', clientA.id);
      expect(res.body.client).toHaveProperty('name', clientA.name);

      clientAToken = res.body.accessToken;
    });

    it('should login client B successfully and return distinct tenant token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/auth/login')
        .send({ email: 'beta.admin@betalogistics.com', password: 'BetaAdmin@123' });

      expect(res.status).toBe(200);
      expect(res.body.client.id).toBe(clientB.id);
      clientBToken = res.body.accessToken;
    });

    it('should retrieve current client profile via /api/client/auth/me', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/auth/me')
        .set('Authorization', `Bearer ${clientAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alpha.admin@alphacorp.com');
      expect(res.body.client.id).toBe(clientA.id);
    });

    it('should update profile name and mobile', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/client/auth/profile')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ name: 'Alpha Administrator Updated', mobile: '+91 9988776655' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Alpha Administrator Updated');
      expect(res.body.mobile).toBe('+91 9988776655');
    });

    it('should update user notification preferences', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/client/auth/preferences')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({
          preferences: {
            emailAlerts: true,
            whatsappAlerts: false,
            dailyDigest: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.preferences).toHaveProperty('emailAlerts', true);
    });
  });

  describe('2. Client Users Management', () => {
    it('should create a Sales Executive user attached to Client A', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/users')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({
          name: 'Sarah Sales Exec',
          email: 'sarah.sales@alphacorp.com',
          mobile: '+91 9123456789',
          role: 'SALES_EXECUTIVE',
          password: 'ExecPassword@123',
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe('sarah.sales@alphacorp.com');
      expect(res.body.role).toBe('SALES_EXECUTIVE');
      createdSalesExecId = res.body.id;
    });

    it('should reject creating duplicate email (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/users')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({
          name: 'Duplicate Sarah',
          email: 'sarah.sales@alphacorp.com',
          role: 'SALES_EXECUTIVE',
          password: 'AnyPassword@123',
        });

      expect(res.status).toBe(409);
    });

    it('should list users belonging only to Client A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/users')
        .set('Authorization', `Bearer ${clientAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      // Ensure no Beta logistics user is returned
      const betaFound = res.body.data.some((u: any) => u.email === 'beta.admin@betalogistics.com');
      expect(betaFound).toBe(false);
    });

    it('should allow created Sales Executive to login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/auth/login')
        .send({ email: 'sarah.sales@alphacorp.com', password: 'ExecPassword@123' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('SALES_EXECUTIVE');
      salesExecToken = res.body.accessToken;
    });

    it('should deactivate user and prevent login (401)', async () => {
      // Deactivate Sarah
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/client/users/${createdSalesExecId}/status`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ isActive: false });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.isActive).toBe(false);

      // Try login as deactivated user
      const loginRes = await request(app.getHttpServer())
        .post('/api/client/auth/login')
        .send({ email: 'sarah.sales@alphacorp.com', password: 'ExecPassword@123' });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body.message).toContain('deactivated');

      // Re-activate Sarah
      await request(app.getHttpServer())
        .patch(`/api/client/users/${createdSalesExecId}/status`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ isActive: true });
    });
  });

  describe('3. Teams Management', () => {
    it('should create a Sales Team in Client A and assign members', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/teams')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({
          name: 'Direct Sales Alpha',
          description: 'Inbound & outbound direct sales team',
          type: 'SALES',
          memberIds: [createdSalesExecId],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Direct Sales Alpha');
      expect(res.body.members.length).toBe(1);
      expect(res.body.members[0].id).toBe(createdSalesExecId);
      createdTeamId = res.body.id;
    });

    it('should list teams belonging to Client A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/teams')
        .set('Authorization', `Bearer ${clientAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].name).toBe('Direct Sales Alpha');
    });

    it('should toggle team status to inactive and active', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/client/teams/${createdTeamId}/status`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  describe('4. Roles, Permissions & RBAC Enforcement', () => {
    it('should get roles definition and permissions matrix', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/roles/matrix')
        .set('Authorization', `Bearer ${clientAToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('roles');
      expect(res.body).toHaveProperty('modules');
    });

    it('should prevent Sales Executive from creating other users (RBAC check)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/client/users')
        .set('Authorization', `Bearer ${salesExecToken}`)
        .send({
          name: 'Unauthorized User',
          email: 'unauth@alphacorp.com',
          role: 'VIEWER',
          password: 'Pass@123456',
        });

      // Sales Executive does not have users:create permission
      expect(res.status).toBe(403);
    });
  });

  describe('5. Client Dashboard & Activity Logs', () => {
    it('should return client-specific dashboard stats strictly for Client A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/dashboard/stats')
        .set('Authorization', `Bearer ${clientAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.client.id).toBe(clientA.id);
      expect(res.body.kpis.totalUsers).toBeGreaterThanOrEqual(2);
      expect(res.body.kpis.totalTeams).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('funnel');
      expect(res.body).toHaveProperty('teamPerformance');
    });

    it('should fetch client activity logs recording recent user actions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/activity-logs')
        .set('Authorization', `Bearer ${clientAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const actions = res.body.data.map((l: any) => l.action);
      expect(actions).toContain('CLIENT_USER_CREATED');
    });
  });

  describe('6. MANDATORY Multi-Tenant Security & Isolation', () => {
    it('should reject Client B when attempting to view Client A user by ID (404/403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/client/users/${createdSalesExecId}`)
        .set('Authorization', `Bearer ${clientBToken}`);

      // Client B must never be able to access Client A's user details
      expect(res.status).toBe(404);
    });

    it('should reject Client B when attempting to update Client A user (404/403)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/client/users/${createdSalesExecId}`)
        .set('Authorization', `Bearer ${clientBToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(404);
    });

    it('should reject Client B when attempting to view Client A team by ID (404/403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/client/teams/${createdTeamId}`)
        .set('Authorization', `Bearer ${clientBToken}`);

      expect(res.status).toBe(404);
    });

    it('should ensure Client B user list contains ZERO Client A users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/users')
        .set('Authorization', `Bearer ${clientBToken}`);

      expect(res.status).toBe(200);
      const hasAlphaUsers = res.body.data.some(
        (u: any) => u.email === 'alpha.admin@alphacorp.com' || u.email === 'sarah.sales@alphacorp.com',
      );
      expect(hasAlphaUsers).toBe(false);
    });

    it('should ensure Client B dashboard contains ZERO Client A metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/client/dashboard/stats')
        .set('Authorization', `Bearer ${clientBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.client.id).toBe(clientB.id);
      expect(res.body.kpis.totalTeams).toBe(0); // Client B has 0 teams created
    });
  });
});
