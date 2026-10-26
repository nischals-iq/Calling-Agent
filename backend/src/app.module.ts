import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module.js';
import { AdminDashboardModule } from './modules/admin-dashboard/admin-dashboard.module.js';
import { AdminClientsModule } from './modules/admin-clients/admin-clients.module.js';
import { AdminPlansModule } from './modules/admin-plans/admin-plans.module.js';
import { AdminUsersModule } from './modules/admin-users/admin-users.module.js';
import { ClientAuthModule } from './modules/client-auth/client-auth.module.js';
import { ClientUsersModule } from './modules/client-users/client-users.module.js';
import { ClientTeamsModule } from './modules/client-teams/client-teams.module.js';
import { ClientDashboardModule } from './modules/client-dashboard/client-dashboard.module.js';
import { ClientActivityLogsModule } from './modules/client-activity-logs/client-activity-logs.module.js';
import { ClientRolesModule } from './modules/client-roles/client-roles.module.js';
import { LeadCaptureModule } from './modules/lead-capture/lead-capture.module.js';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { ClientCampaignsModule } from './modules/client-campaigns/client-campaigns.module.js';
import { AiCallingModule } from './modules/ai-calling/ai-calling.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    PrismaModule,
    AuditLogsModule,
    AdminAuthModule,
    AdminDashboardModule,
    AdminClientsModule,
    AdminPlansModule,
    AdminUsersModule,
    ClientAuthModule,
    ClientUsersModule,
    ClientTeamsModule,
    ClientDashboardModule,
    ClientActivityLogsModule,
    ClientRolesModule,
    LeadCaptureModule,
    IntegrationsModule,
    ClientCampaignsModule,
    AiCallingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
