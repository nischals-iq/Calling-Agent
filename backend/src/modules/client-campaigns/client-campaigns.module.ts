import { Module } from '@nestjs/common';
import { ClientCampaignsController } from './client-campaigns.controller.js';
import { ClientCampaignsService } from './client-campaigns.service.js';
import { InternalCampaignsController } from './controllers/internal-campaigns.controller.js';
import { InternalCampaignsService } from './services/internal-campaigns.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';

@Module({
  imports: [PrismaModule, IntegrationsModule],
  controllers: [ClientCampaignsController, InternalCampaignsController],
  providers: [ClientCampaignsService, InternalCampaignsService],
  exports: [ClientCampaignsService, InternalCampaignsService],
})
export class ClientCampaignsModule {}
