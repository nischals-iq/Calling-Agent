import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { LeadCaptureModule } from '../lead-capture/lead-capture.module.js';
import { IntegrationsController } from './integrations.controller.js';
import { WebhooksController } from './webhooks.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { IntegrationEncryptionService } from './services/integration-encryption.service.js';
import { IntegrationNormalizerService } from './services/integration-normalizer.service.js';
import { MetaIntegrationService } from './services/meta-integration.service.js';
import { GoogleIntegrationService } from './services/google-integration.service.js';
import { LinkedinIntegrationService } from './services/linkedin-integration.service.js';

@Module({
  imports: [PrismaModule, AuditLogsModule, LeadCaptureModule],
  controllers: [IntegrationsController, WebhooksController],
  providers: [
    IntegrationsService,
    IntegrationEncryptionService,
    IntegrationNormalizerService,
    MetaIntegrationService,
    GoogleIntegrationService,
    LinkedinIntegrationService,
  ],
  exports: [
    IntegrationsService,
    IntegrationEncryptionService,
    IntegrationNormalizerService,
    MetaIntegrationService,
    GoogleIntegrationService,
    LinkedinIntegrationService,
  ],
})
export class IntegrationsModule {}
