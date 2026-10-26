import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { LeadIngestionService } from './lead-ingestion.service.js';
import { LeadCaptureService } from './lead-capture.service.js';
import { LeadCaptureController } from './lead-capture.controller.js';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [LeadCaptureController],
  providers: [LeadIngestionService, LeadCaptureService],
  exports: [LeadIngestionService, LeadCaptureService],
})
export class LeadCaptureModule {}
