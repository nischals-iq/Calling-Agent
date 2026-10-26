import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { MetaIntegrationService } from '../src/modules/integrations/services/meta-integration.service.js';

describe('Meta Campaign Creation (Step 2 E2E Test)', () => {
  let app: INestApplication;
  let metaService: MetaIntegrationService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    metaService = app.get(MetaIntegrationService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a single PAUSED Meta test campaign and verify via read-back', async () => {
    const clientId = 'ece818d0-950c-480a-8873-00484c8f7ba9'; // Supra
    const res = await metaService.createTestCampaign(clientId, 'FirstCall Meta Test Campaign');
    console.log('CAMPAIGN_CREATION_RESULT:', JSON.stringify(res, null, 2));

    expect(res.success).toBe(true);
    expect(res.campaignId).toBeDefined();
    expect(res.status).toBe('PAUSED');
    expect(res.verification.verified).toBe(true);
  }, 30000);
});
