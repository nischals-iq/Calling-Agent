import { Module } from '@nestjs/common';
import { ClientTeamsController } from './client-teams.controller.js';
import { ClientTeamsService } from './client-teams.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [ClientTeamsController],
  providers: [ClientTeamsService],
  exports: [ClientTeamsService],
})
export class ClientTeamsModule {}
